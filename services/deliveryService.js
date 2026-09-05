const Line = require('../models/lineModel');
const Shop = require('../models/shopModel');
const Order = require('../models/orderModel');
const Payment = require('../models/paymentModel');
const { SnackModel: Snack } = require('../models/snackModel');
const PaymentService = require('./paymentService');
const LineService = require('./lineService');

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function inputError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

class DeliveryService {
  async assertLineShop(lineId, shopId) {
    const [line, shop] = await Promise.all([Line.findById(lineId), Shop.findById(shopId)]);
    if (!line) throw inputError('Line not found', 404);
    if (!shop) throw inputError('Shop not found', 404);
    if (!line.shops.some((entry) => String(entry.shopId) === String(shopId))) {
      throw inputError('Add this shop to the line before recording a delivery');
    }
    if (line.status !== 'OPEN') throw inputError('This line is closed and cannot be changed');
    return { line, shop };
  }

  async buildItems(rawItems = []) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw inputError('Add at least one snack for an item-wise delivery');
    }

    const snackIds = rawItems.map((item) => item.snackId);
    const snacks = await Snack.find({ _id: { $in: snackIds } });
    const snackMap = new Map(snacks.map((snack) => [String(snack._id), snack]));

    const items = [];
    for (const rawItem of rawItems) {
      const snack = snackMap.get(String(rawItem.snackId));
      const quantity = Number(rawItem.quantity ?? rawItem.orderedQuantity);
      if (!snack) throw inputError('One of the selected snacks no longer exists', 404);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw inputError(`Enter a valid quantity for ${snack.name}`);
      }
      if (snack.stock < quantity) {
        throw inputError(`${snack.name} has only ${snack.stock} items in stock`);
      }

      items.push({
        snackId: snack._id,
        orderedQuantity: quantity,
        fulfilledQuantity: quantity,
        fulfillmentStatus: 'FULFILLED',
        unitPrice: snack.sellingPrice,
        totalPrice: roundMoney(quantity * snack.sellingPrice)
      });
    }

    return { items, snacks: snackMap };
  }

  async adjustStock(items, direction) {
    for (const item of items) {
      const quantity = item.orderedQuantity || item.fulfilledQuantity;
      await Snack.findByIdAndUpdate(item.snackId, { $inc: { stock: direction * quantity } });
    }
  }

  async syncLineTotals(lineId) {
    return LineService.syncLineTotals(lineId);
  }

  async getDelivery(orderId) {
    const order = await Order.findById(orderId)
      .populate('shopId', 'name ownerName ownerNumber address')
      .populate('items.snackId', 'name sellingPrice')
      .lean();
    if (!order) throw inputError('Delivery not found', 404);

    const payments = await Payment.find({ sourceOrderId: order._id }).sort({ paymentDate: -1 }).lean();
    const collectedAmount = roundMoney(payments.reduce((sum, payment) => sum + payment.amountPaid, 0));
    return {
      ...order,
      collectedAmount,
      deliveryPendingAmount: Math.max(0, roundMoney(order.totalPayableAmount - collectedAmount)),
      collectionPayments: payments
    };
  }

  async createDelivery(data) {
    const { lineId, shopId } = data;
    await this.assertLineShop(lineId, shopId);

    const entryType = data.entryType === 'ITEMIZED' ? 'ITEMIZED' : 'QUICK';
    let items = [];
    let totalAmount;
    if (entryType === 'ITEMIZED') {
      const itemData = await this.buildItems(data.items);
      items = itemData.items;
      totalAmount = roundMoney(items.reduce((sum, item) => sum + item.totalPrice, 0));
      await this.adjustStock(items, -1);
    } else {
      totalAmount = roundMoney(data.totalAmount);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        throw inputError('Enter a total amount greater than zero');
      }
    }

    const order = await Order.create({
      lineId,
      shopId,
      entryType,
      notes: data.notes || '',
      items,
      totalAmount,
      totalPayableAmount: totalAmount,
      paidAmount: 0,
      pendingAmount: totalAmount,
      deliveryStatus: 'DELIVERED'
    });

    const collectedAmount = roundMoney(data.collectedAmount || 0);
    if (!Number.isFinite(collectedAmount) || collectedAmount < 0) {
      throw inputError('Collected amount must be a valid non-negative number');
    }
    if (collectedAmount > totalAmount + 0.005) {
      throw inputError('Collected amount cannot be greater than the delivery amount');
    }

    // Attach the new order before a payment is accepted. The line summary IDs
    // form the boundary of this visit and prevent a remove + re-add from
    // inheriting its previous delivery figures.
    await LineService.addOrder(lineId, shopId, order._id, totalAmount);
    if (collectedAmount > 0) {
      await PaymentService.processShopPayment({
        lineId,
        shopId,
        sourceOrderId: order._id,
        amountPaid: collectedAmount,
        paymentMode: data.paymentMode || 'CASH',
        transactionRef: data.transactionRef,
        notes: data.notes
      });
    }

    await this.syncLineTotals(lineId);
    return this.getDelivery(order._id);
  }

  async updateDelivery(orderId, data) {
    const order = await Order.findById(orderId);
    if (!order) throw inputError('Delivery not found', 404);
    await this.assertLineShop(order.lineId, order.shopId);

    const collectedWasProvided = data.collectedAmount !== undefined;
    const requestedCollection = collectedWasProvided ? roundMoney(data.collectedAmount) : null;
    if (collectedWasProvided && (!Number.isFinite(requestedCollection) || requestedCollection < 0)) {
      throw inputError('Collected amount must be a valid non-negative number');
    }

    const sourcePayment = collectedWasProvided
      ? await Payment.findOne({ sourceOrderId: order._id }).sort({ createdAt: 1 })
      : null;
    const ensureCollectionFitsTotal = (total) => {
      if (collectedWasProvided && requestedCollection > total + 0.005) {
        throw inputError('Collected amount cannot be greater than the delivery amount');
      }
    };

    if (order.entryType === 'QUICK') {
      const totalAmount = roundMoney(data.totalAmount);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        throw inputError('Enter a total amount greater than zero');
      }
      ensureCollectionFitsTotal(totalAmount);
      order.totalAmount = totalAmount;
      order.totalPayableAmount = totalAmount;
      order.pendingAmount = Math.max(0, totalAmount - (order.paidAmount || 0));
    } else if (data.items) {
      // Temporarily put the old stock back while validating the replacement
      // items. If validation fails, restore it so a failed edit never changes
      // inventory.
      await this.adjustStock(order.items, 1);
      try {
        const itemData = await this.buildItems(data.items);
        const itemTotal = roundMoney(itemData.items.reduce((sum, item) => sum + item.totalPrice, 0));
        ensureCollectionFitsTotal(itemTotal);
        await this.adjustStock(itemData.items, -1);
        order.items = itemData.items;
        order.totalAmount = itemTotal;
        order.totalPayableAmount = itemTotal;
        order.pendingAmount = Math.max(0, itemTotal - (order.paidAmount || 0));
      } catch (error) {
        await this.adjustStock(order.items, -1);
        throw error;
      }
    }

    if (data.notes !== undefined) order.notes = data.notes;
    await order.save();

    if (collectedWasProvided) {
      if (sourcePayment && requestedCollection === 0) {
        await Payment.deleteOne({ _id: sourcePayment._id });
      } else if (sourcePayment) {
        // Replacing an initial collection can only use the balance left after
        // its existing amount is put back into the visit's available amount.
        await PaymentService.assertLinePaymentIsWithinBalance(
          order.lineId,
          order.shopId,
          requestedCollection,
          sourcePayment.amountPaid
        );
        sourcePayment.amountPaid = requestedCollection;
        sourcePayment.paymentMode = data.paymentMode || sourcePayment.paymentMode;
        sourcePayment.notes = data.notes ?? sourcePayment.notes;
        await sourcePayment.save();
      } else if (requestedCollection > 0) {
        await PaymentService.processShopPayment({
          lineId: order.lineId,
          shopId: order.shopId,
          sourceOrderId: order._id,
          amountPaid: requestedCollection,
          paymentMode: data.paymentMode || 'CASH',
          notes: data.notes || ''
        });
      }
    }

    await PaymentService.rebuildShopBalances(order.shopId);
    await this.syncLineTotals(order.lineId);
    return this.getDelivery(order._id);
  }

  async deleteDelivery(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw inputError('Delivery not found', 404);
    await this.assertLineShop(order.lineId, order.shopId);

    await this.adjustStock(order.items, 1);
    await Payment.deleteMany({ sourceOrderId: order._id });
    await Order.deleteOne({ _id: order._id });
    await PaymentService.rebuildShopBalances(order.shopId);
    await this.syncLineTotals(order.lineId);
  }

  async getShopHistory(shopId) {
    const [shop, payments] = await Promise.all([
      Shop.findById(shopId).lean(),
      Payment.find({ shopId }).sort({ paymentDate: -1, createdAt: -1 }).lean()
    ]);
    if (!shop) throw inputError('Shop not found', 404);
    return { shop, payments };
  }
}

module.exports = new DeliveryService();

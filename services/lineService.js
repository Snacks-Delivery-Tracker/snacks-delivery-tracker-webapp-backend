const Line = require('../models/lineModel');
const Shop = require('../models/shopModel');
const Order = require('../models/orderModel');
const Payment = require('../models/paymentModel');

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

class LineService {
  /**
   * 1. Create a new line
   */
  async createLine(lineName, deliveryDate = null) {
    const line = await Line.create({
      lineName,
      deliveryDate: deliveryDate || new Date(),
      status: 'OPEN',
      shops: [],
      totalGoodsDelivered: 0,
      totalCashCollected: 0
    });
    return line;
  }

  /**
   * 2. Add a shop to an existing Line — always starts fresh.
   * We intentionally do NOT carry over orders/payments from previous visits.
   * If this shop was removed and re-added, the old orders/payments stay in the
   * DB for history but are no longer scoped to this shop entry on this line.
   * addOrder() / addPayment() will attach new activity as it happens.
   */
  async addShop(lineId, shopId) {
    const line = await Line.findById(lineId);
    if (!line) throw new Error('Line not found');
    if (line.status !== 'OPEN') throw new Error('A closed line cannot be changed');

    const shop = await Shop.findById(shopId);
    if (!shop) throw new Error('Shop not found');

    // Prevent duplicate
    const existingIndex = line.shops.findIndex(
      (s) => s.shopId.toString() === shopId.toString()
    );
    if (existingIndex !== -1) {
      throw new Error('Shop already exists in this line');
    }

    // Always start fresh — snapshot the shop's current balance at add-time
    line.shops.push({
      shopId: shop._id,
      startingOutstanding: shop.totalOutstandingBalance || 0,
      startingCredit: shop.creditBalance || 0,
      ordersDeliveredAmount: 0,
      paymentsCollected: 0,
      orderIds: [],
      paymentIds: []
    });

    line.totalGoodsDelivered = line.shops.reduce((sum, s) => sum + s.ordersDeliveredAmount, 0);
    line.totalCashCollected = line.shops.reduce((sum, s) => sum + s.paymentsCollected, 0);

    await line.save();
    return line;
  }

  /**
   * 3. Clone an existing line with refreshed starting balances for all shops
   */
  async cloneLine(sourceLineId, newLineName) {
    const sourceLine = await Line.findById(sourceLineId);
    if (!sourceLine) throw new Error('Source line not found');

    const shopIds = sourceLine.shops.map((s) => s.shopId);

    // Fetch latest live shop data from DB
    const liveShops = await Shop.find({ _id: { $in: shopIds } }).lean();
    const liveShopMap = new Map(
      liveShops.map((s) => [s._id.toString(), s])
    );

    // Build refreshed shop summaries with live balances for the new route run
    const clonedShops = sourceLine.shops.map((item) => {
      const liveShop = liveShopMap.get(item.shopId.toString());
      return {
        shopId: item.shopId,
        startingOutstanding: liveShop ? liveShop.totalOutstandingBalance || 0 : 0,
        startingCredit: liveShop ? liveShop.creditBalance || 0 : 0,
        ordersDeliveredAmount: 0,
        paymentsCollected: 0,
        orderIds: [],
        paymentIds: []
      };
    });

    const newLine = await Line.create({
      lineName: newLineName,
      status: 'OPEN',
      shops: clonedShops,
      totalGoodsDelivered: 0,
      totalCashCollected: 0
    });

    return newLine;
  }

  /**
   * 4. Attach an Order to a Shop on the Line
   */
  async addOrder(lineId, shopId, orderId, orderAmount) {
    const line = await Line.findById(lineId);
    if (!line) throw new Error('Line not found');

    const shopSummary = line.shops.find(
      (s) => s.shopId.toString() === shopId.toString()
    );

    if (!shopSummary) {
      throw new Error('Shop is not part of this line');
    }

    // Add order reference if not already attached
    if (!shopSummary.orderIds.some((id) => id.toString() === orderId.toString())) {
      shopSummary.orderIds.push(orderId);
      shopSummary.ordersDeliveredAmount = roundMoney((shopSummary.ordersDeliveredAmount || 0) + Number(orderAmount));
      line.totalGoodsDelivered = roundMoney((line.totalGoodsDelivered || 0) + Number(orderAmount));
      await line.save();
    }

    return line;
  }

  /**
   * 5. Attach a Payment to a Shop on the Line
   */
  async addPayment(lineId, shopId, paymentId, paymentAmount) {
    const line = await Line.findById(lineId);
    if (!line) throw new Error('Line not found');

    const shopSummary = line.shops.find(
      (s) => s.shopId.toString() === shopId.toString()
    );

    if (!shopSummary) {
      throw new Error('Shop is not part of this line');
    }

    // Add payment reference if not already attached
    if (!shopSummary.paymentIds.some((id) => id.toString() === paymentId.toString())) {
      shopSummary.paymentIds.push(paymentId);
      shopSummary.paymentsCollected = roundMoney((shopSummary.paymentsCollected || 0) + Number(paymentAmount));
      line.totalCashCollected = roundMoney((line.totalCashCollected || 0) + Number(paymentAmount));
      await line.save();
    }

    return line;
  }

  async findById(lineId) {
    return Line.findById(lineId);
  }

  async closeLine(lineId) {
    const line = await Line.findById(lineId);
    if (!line) throw new Error('Line not found');
    if (line.status === 'CLOSED') throw new Error('Line already closed');

    for (const shopLineSummary of line.shops) {
      const shop = await Shop.findById(shopLineSummary.shopId);
      if (shop) {
        shopLineSummary.endingOutstanding = shop.totalOutstandingBalance;
        shopLineSummary.endingCredit = shop.creditBalance;
      }
    }

    line.status = 'CLOSED';
    line.endTime = new Date();
    await line.save();
    return line;
  }

  /**
   * Remove a shop from an existing Line
   */
  async removeShop(lineId, shopId) {
    const line = await Line.findById(lineId);
    if (!line) throw new Error('Line not found');
    if (line.status !== 'OPEN') throw new Error('A closed line cannot be changed');

    const shopExists = line.shops.some((s) => String(s.shopId) === String(shopId));
    if (!shopExists) throw new Error('Shop is not part of this line');

    line.shops = line.shops.filter((s) => String(s.shopId) !== String(shopId));

    line.totalGoodsDelivered = line.shops.reduce((sum, s) => sum + (s.ordersDeliveredAmount || 0), 0);
    line.totalCashCollected = line.shops.reduce((sum, s) => sum + (s.paymentsCollected || 0), 0);

    await line.save();
    return line;
  }

  /**
   * Validate that activity is being recorded against an open visit and return
   * the visit-scoped amounts.  These values deliberately come from the IDs
   * saved on the line summary, never from every historical order for the shop.
   */
  async getLineVisitBalance(lineId, shopId) {
    const line = await Line.findById(lineId).lean();
    if (!line) throw Object.assign(new Error('Line not found'), { status: 404 });
    if (line.status !== 'OPEN') throw Object.assign(new Error('This line is closed and cannot be changed'), { status: 400 });

    const summary = line.shops.find((entry) => String(entry.shopId) === String(shopId));
    if (!summary) throw Object.assign(new Error('Shop is not part of this line'), { status: 400 });

    const [orders, payments] = await Promise.all([
      summary.orderIds?.length
        ? Order.find({ _id: { $in: summary.orderIds }, deliveryStatus: { $ne: 'CANCELLED' } }).lean()
        : Promise.resolve([]),
      summary.paymentIds?.length
        ? Payment.find({ _id: { $in: summary.paymentIds } }).lean()
        : Promise.resolve([])
    ]);

    const delivered = roundMoney(orders.reduce((sum, order) => sum + (order.totalPayableAmount || 0), 0));
    const collected = roundMoney(payments.reduce((sum, payment) => sum + (payment.amountPaid || 0), 0));

    return {
      line,
      summary,
      delivered,
      collected,
      pending: Math.max(0, roundMoney(delivered - collected))
    };
  }

  /**
   * Recalculate stored totals from each shop entry's visit-scoped IDs.
   *
   * A shop can be removed and later re-added to the same line. Querying all
   * orders by lineId here would incorrectly resurrect the removed visit, so
   * this method must only use the IDs held by the current line entry.
   */
  async syncLineTotals(lineId) {
    const line = await Line.findById(lineId);
    if (!line) return null;

    const orderIds = line.shops.flatMap((summary) => summary.orderIds || []);
    const paymentIds = line.shops.flatMap((summary) => summary.paymentIds || []);
    const [orders, payments] = await Promise.all([
      orderIds.length
        ? Order.find({ _id: { $in: orderIds }, deliveryStatus: { $ne: 'CANCELLED' } }).lean()
        : Promise.resolve([]),
      paymentIds.length ? Payment.find({ _id: { $in: paymentIds } }).lean() : Promise.resolve([])
    ]);

    const ordersById = new Map(orders.map((order) => [String(order._id), order]));
    const paymentsById = new Map(payments.map((payment) => [String(payment._id), payment]));

    for (const summary of line.shops) {
      const visitOrders = (summary.orderIds || []).map((id) => ordersById.get(String(id))).filter(Boolean);
      const visitPayments = (summary.paymentIds || []).map((id) => paymentsById.get(String(id))).filter(Boolean);
      summary.ordersDeliveredAmount = roundMoney(visitOrders.reduce(
        (sum, order) => sum + (order.totalPayableAmount || 0), 0
      ));
      summary.paymentsCollected = roundMoney(visitPayments.reduce(
        (sum, payment) => sum + (payment.amountPaid || 0), 0
      ));
    }

    line.totalGoodsDelivered = roundMoney(line.shops.reduce(
      (sum, summary) => sum + (summary.ordersDeliveredAmount || 0), 0
    ));
    line.totalCashCollected = roundMoney(line.shops.reduce(
      (sum, summary) => sum + (summary.paymentsCollected || 0), 0
    ));
    await line.save();
    return line;
  }

  /**
   * Permanently remove one line and only the deliveries/payments explicitly
   * attached to it. Shop master records are retained and item stock is put
   * back before the orders are removed.
   */
  async deleteLine(lineId) {
    const line = await Line.findById(lineId);
    if (!line) throw Object.assign(new Error('Line not found'), { status: 404 });

    const orderIds = line.shops.flatMap((summary) => summary.orderIds || []);
    const paymentIds = line.shops.flatMap((summary) => summary.paymentIds || []);
    const orders = orderIds.length
      ? await Order.find({ _id: { $in: orderIds } }).lean()
      : [];
    const shopIds = [...new Set(line.shops.map((summary) => String(summary.shopId)))];

    // Load lazily to avoid a module-load cycle: PaymentService already uses
    // LineService to record a newly collected payment.
    const Snack = require('../models/snackModel').SnackModel;
    for (const order of orders) {
      for (const item of order.items || []) {
        const quantity = item.orderedQuantity || item.fulfilledQuantity || 0;
        if (quantity > 0) await Snack.findByIdAndUpdate(item.snackId, { $inc: { stock: quantity } });
      }
    }

    if (paymentIds.length) await Payment.deleteMany({ _id: { $in: paymentIds } });
    if (orderIds.length) await Order.deleteMany({ _id: { $in: orderIds } });
    await Line.deleteOne({ _id: line._id });

    const PaymentService = require('./paymentService');
    await Promise.all(shopIds.map((shopId) => PaymentService.rebuildShopBalances(shopId)));

    return { deletedLineId: line._id, deletedDeliveries: orders.length };
  }

  async getCurrentLine() {
    return Line.findOne({ status: 'OPEN' }).sort({ deliveryDate: -1, createdAt: -1 });
  }

  async listLines() {
    return Line.find().sort({ deliveryDate: -1, createdAt: -1 }).lean();
  }

  async getLineDetails(lineId) {
    const line = await Line.findById(lineId).lean();
    if (!line) throw new Error('Line not found');

    const shopIds = line.shops.map((entry) => entry.shopId);

    // Use the per-shop orderIds / paymentIds stored on the Line document as the
    // source of truth. This means only activity recorded AFTER the shop was
    // (last) added to this line is counted — old orders/payments from a
    // previous remove+re-add cycle are automatically excluded.
    const allOrderIds   = line.shops.flatMap((s) => s.orderIds  || []);
    const allPaymentIds = line.shops.flatMap((s) => s.paymentIds || []);

    const [shops, orders, payments] = await Promise.all([
      Shop.find({ _id: { $in: shopIds } }).lean(),
      allOrderIds.length
        ? Order.find({ _id: { $in: allOrderIds } })
            .populate('items.snackId', 'name sellingPrice')
            .sort({ orderDate: -1, createdAt: -1 })
            .lean()
        : Promise.resolve([]),
      allPaymentIds.length
        ? Payment.find({ _id: { $in: allPaymentIds } }).lean()
        : Promise.resolve([])
    ]);

    const shopMap       = new Map(shops.map((shop) => [String(shop._id), shop]));
    const ordersByShop  = new Map();
    const collectedByShop = new Map();

    // Build per-shop order list scoped to this visit's orderIds
    for (const order of orders) {
      const shopId = String(order.shopId);
      const list = ordersByShop.get(shopId) || [];
      list.push(order);
      ordersByShop.set(shopId, list);
    }

    // Sum payments scoped to this visit's paymentIds only
    for (const payment of payments) {
      const shopId = String(payment.shopId);
      collectedByShop.set(shopId, (collectedByShop.get(shopId) || 0) + (payment.amountPaid || 0));
    }

    const detailedShops = line.shops.map((summary) => {
      const shopId = String(summary.shopId);
      const shopOrders = ordersByShop.get(shopId) || [];
      const totalAmount = shopOrders.reduce((sum, o) => sum + (o.totalPayableAmount || 0), 0);
      const collectedAmount = collectedByShop.get(shopId) || 0;
      return {
        ...shopMap.get(shopId),
        lineSummary: summary,
        orders: shopOrders,
        latestOrder: shopOrders[0] || null,
        totalAmount,
        collectedAmount,
        pendingAmount: Math.max(0, totalAmount - collectedAmount)
      };
    }).filter((shop) => shop._id);

    const totalAmount     = detailedShops.reduce((sum, shop) => sum + shop.totalAmount, 0);
    const collectedAmount = detailedShops.reduce((sum, shop) => sum + shop.collectedAmount, 0);

    return {
      ...line,
      shops: detailedShops,
      summary: {
        shops: detailedShops.length,
        totalAmount,
        collectedAmount,
        pendingAmount: Math.max(0, totalAmount - collectedAmount)
      }
    };
  }
}

module.exports = new LineService();

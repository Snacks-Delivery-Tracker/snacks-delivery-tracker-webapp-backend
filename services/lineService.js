const Line = require('../models/lineModel');
const Shop = require('../models/shopModel');
const Order = require('../models/orderModel');
const Payment = require('../models/paymentModel');

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

class LineService {
  /**
   * 1. Create a new line
   */
  async createLine(lineName, deliveryDate = null, lineType = 'DEFAULT', weekday = '') {
    const line = await Line.create({
      lineName,
      lineType,
      weekday,
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
   * Bulk add multiple shops to a line (e.g. for weekday auto-loading)
   */
  async bulkAddShops(lineId, shopIds) {
    const line = await Line.findById(lineId);
    if (!line) throw new Error('Line not found');
    if (line.status !== 'OPEN') throw new Error('A closed line cannot be changed');

    const shops = await Shop.find({ _id: { $in: shopIds } });
    if (shops.length === 0) return line;

    const existingShopIds = new Set(line.shops.map((s) => s.shopId.toString()));
    
    let addedAny = false;
    for (const shop of shops) {
      if (!existingShopIds.has(shop._id.toString())) {
        line.shops.push({
          shopId: shop._id,
          startingOutstanding: shop.totalOutstandingBalance || 0,
          startingCredit: shop.creditBalance || 0,
          ordersDeliveredAmount: 0,
          paymentsCollected: 0,
          orderIds: [],
          paymentIds: []
        });
        addedAny = true;
      }
    }

    if (addedAny) {
      line.totalGoodsDelivered = line.shops.reduce((sum, s) => sum + s.ordersDeliveredAmount, 0);
      line.totalCashCollected = line.shops.reduce((sum, s) => sum + s.paymentsCollected, 0);
      await line.save();
    }
    
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

    // 1. Fully hydrate the line details BEFORE closing it
    const hydratedLine = await this.getLineDetails(lineId);

    // 2. Update shop lifetime stats & ending balances
    for (const shopData of hydratedLine.shops) {
      const shop = await Shop.findById(shopData._id);
      if (shop) {
        shop.lifetimeBilled = roundMoney((shop.lifetimeBilled || 0) + shopData.totalAmount);
        shop.lifetimeReceived = roundMoney((shop.lifetimeReceived || 0) + shopData.collectedAmount);
        await shop.save();
      }
      // find the summary in the original line doc
      const shopLineSummary = line.shops.find(s => String(s.shopId) === String(shopData._id));
      if (shopLineSummary && shop) {
        shopLineSummary.endingOutstanding = shop.totalOutstandingBalance;
        shopLineSummary.endingCredit = shop.creditBalance;
      }
    }

    // 3. Save the snapshot and close
    line.status = 'CLOSED';
    line.endTime = new Date();
    
    // We update the hydratedLine with the ending balances just calculated
    for (const shopLineSummary of line.shops) {
      const hdShop = hydratedLine.shops.find(s => String(s._id) === String(shopLineSummary.shopId));
      if (hdShop) {
        hdShop.lineSummary.endingOutstanding = shopLineSummary.endingOutstanding;
        hdShop.lineSummary.endingCredit = shopLineSummary.endingCredit;
      }
    }
    
    hydratedLine.status = 'CLOSED';
    hydratedLine.endTime = line.endTime;
    line.billSnapshot = hydratedLine;

    // 4. Gather all Order and Payment IDs to delete
    const orderIdsToDelete = line.shops.flatMap((summary) => summary.orderIds || []);
    const paymentIdsToDelete = line.shops.flatMap((summary) => summary.paymentIds || []);

    // 5. Clear the arrays on the line document to save space
    for (const summary of line.shops) {
      summary.orderIds = [];
      summary.paymentIds = [];
    }

    await line.save();

    // 6. Delete the Orders and Payments (without returning stock)
    if (paymentIdsToDelete.length) await Payment.deleteMany({ _id: { $in: paymentIdsToDelete } });
    if (orderIdsToDelete.length) await Order.deleteMany({ _id: { $in: orderIdsToDelete } });

    // The line.save() might not return the full populated details, so we can return the hydrated one
    return hydratedLine;
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

    if (line.status === 'CLOSED' && line.billSnapshot) {
      return line.billSnapshot;
    }

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
    const paymentBreakdownByShop = new Map();
    const paymentsByShop = new Map();

    // Build per-shop order list scoped to this visit's orderIds
    for (const order of orders) {
      const shopId = String(order.shopId);
      const list = ordersByShop.get(shopId) || [];
      list.push(order);
      ordersByShop.set(shopId, list);
    }

    // Sum payments scoped to this visit's paymentIds only, and build breakdown
    for (const payment of payments) {
      const shopId = String(payment.shopId);
      collectedByShop.set(shopId, (collectedByShop.get(shopId) || 0) + (payment.amountPaid || 0));
      
      const breakdown = paymentBreakdownByShop.get(shopId) || { CASH: 0, UPI: 0, CARD: 0, CHEQUE: 0, BANK_TRANSFER: 0 };
      const mode = payment.paymentMode || 'CASH';
      breakdown[mode] += (payment.amountPaid || 0);
      paymentBreakdownByShop.set(shopId, breakdown);
      
      const pList = paymentsByShop.get(shopId) || [];
      pList.push(payment);
      paymentsByShop.set(shopId, pList);
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
        pendingAmount: Math.max(0, totalAmount - collectedAmount),
        paymentBreakdown: paymentBreakdownByShop.get(shopId) || { CASH: 0, UPI: 0, CARD: 0, CHEQUE: 0, BANK_TRANSFER: 0 },
        payments: paymentsByShop.get(shopId) || []
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

  async getShopBillFromSnapshot(lineId, shopId) {
    const line = await Line.findById(lineId).lean();
    if (!line) throw new Error('Line not found');
    if (line.status !== 'CLOSED' || !line.billSnapshot) {
      throw new Error('This route is only available for closed lines');
    }

    const shopData = line.billSnapshot.shops.find((s) => String(s._id) === String(shopId));
    if (!shopData) throw new Error('Shop not found in this line');

    const order = shopData.latestOrder;
    if (!order) throw new Error('No delivery recorded for this shop in this line');

    let payments = shopData.payments || [];
    if (!payments.length) {
      // Fallback for older snapshots that only saved the breakdown
      for (const [mode, amount] of Object.entries(shopData.paymentBreakdown || {})) {
        if (amount > 0) {
          payments.push({
            paymentMode: mode,
            amountPaid: amount,
            paymentDate: line.endTime
          });
        }
      }
    }

    return {
      ...order,
      shopId: {
        _id: shopData._id,
        name: shopData.name,
        ownerName: shopData.ownerName,
        ownerNumber: shopData.ownerNumber,
        address: shopData.address
      },
      collectedAmount: shopData.collectedAmount,
      deliveryPendingAmount: shopData.pendingAmount,
      collectionPayments: payments,
      paymentBreakdown: shopData.paymentBreakdown
    };
  }
}

module.exports = new LineService();

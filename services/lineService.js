const Line = require('../models/lineModel');
const Shop = require('../models/shopModel');
const Order = require('../models/orderModel');     // <--- Required for querying existing orders
const Payment = require('../models/paymentModel'); // <--- Required for querying existing payments

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
   * 2. Add a shop to an existing Line
   * Dynamically fetches any existing orders and payments linked to this lineId & shopId
   */
  async addShop(lineId, shopId) {
    const line = await Line.findById(lineId);
    if (!line) throw new Error('Line not found');

    const shop = await Shop.findById(shopId);
    console.log("shop",shopId,shop)
    if (!shop) throw new Error('Shop not found');

    // Check if shop is already in this line
    const existingIndex = line.shops.findIndex(
      (s) => s.shopId.toString() === shopId.toString()
    );

    if (existingIndex !== -1) {
      throw new Error('Shop already exists in this line');
    }

    // Query existing orders and payments already created for this (lineId, shopId) combo
    const existingOrders = await Order.find({ lineId, shopId }).lean();
    const existingPayments = await Payment.find({ lineId, shopId }).lean();

    // Extract ObjectIds
    const orderIds = existingOrders.map((o) => o._id);
    const paymentIds = existingPayments.map((p) => p._id);

    // Calculate sum amounts from existing records
    const ordersDeliveredAmount = existingOrders.reduce(
      (sum, o) => sum + (o.totalPayableAmount || 0), 0
    );
    const paymentsCollected = existingPayments.reduce(
      (sum, p) => sum + (p.amountPaid || 0), 0
    );

    // Capture starting snapshot from Shop model and attach queried records
    line.shops.push({
      shopId: shop._id,
      startingOutstanding: shop.totalOutstandingBalance-ordersDeliveredAmount+paymentsCollected || 0,
      startingCredit: shop.creditBalance-paymentsCollected+ordersDeliveredAmount || 0,
      ordersDeliveredAmount,
      paymentsCollected,
      orderIds,
      paymentIds
    });

    // Recalculate line-wide totals
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
      shopSummary.ordersDeliveredAmount += orderAmount;
      line.totalGoodsDelivered += orderAmount;
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
      shopSummary.paymentsCollected += paymentAmount;
      line.totalCashCollected += paymentAmount;
      await line.save();
    }

    return line;
  }
  async findById(lineId){
    return await Line.find({lineId:lineId});
  }

  async closeLine(lineId){
    const line = await Line.findById(lineId);
    if(line.status=="CLOSED"){
        throw new Error("Line already closed");
    }
    await line.shops.forEach(async (shopLineSummery)=>{
        const shop = await Shop.findById(shopLineSummery.shopId);
        shopLineSummery.endingOutstanding = shop.totalOutstandingBalance;
        shopLineSummery.endingCredit=shop.creditBalance; 
        await shopLineSummery.save()
    })
    line.status="CLOSED";
    await line.save()
    return line;
  }
}

module.exports = new LineService();
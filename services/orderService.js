// services/OrderService.js
const shopService = require("./shopServies")
const NotFoundError = require('../utils/exceptions/NotFoundError')
const Order = require('../models/orderModel');
const SnackService = require('../services/snackServies');
const PaymentService = require("./paymentService")
const LineService = require('./lineService')

class OrderService {
  // CREATE: Place a new order, calculate totals, & deduct inventory
  async createOrder(orderData) {

    if(!orderData.shopId || !shopService.findShopById(orderData.shopId)){
        throw new NotFoundError(`shop with id ${orderData.shopId} not found`)
    }
    if(!orderData.lineId || !LineService.findById(orderData.lineId)){
        throw new NotFoundError(`line with id ${orderData.lineId} not found`)
    }
    orderData.orderDate = new Date();

    // 1. Process items, fetch prices, check & deduct inventory
    for (let item of orderData.items) {
      const snack = await SnackService.findSnackById(item.snackId);
      if (!snack) throw new NotFoundError(`Snack not found for ID: ${item.snackId}`);

      const qty = item.orderedQuantity;
      if (snack.stock < qty) {
        throw new Error(`Insufficient stock for item: ${snack.name}. Available: ${snack.stock}`);
      }

      // Use provided unitPrice or default to snack's selling price
      item.unitPrice = snack.sellingPrice;
      item.fulfilledQuantity = item.fulfilledQuantity ?? qty;
      item.totalPrice = item.fulfilledQuantity * item.unitPrice;

      // Deduct inventory
      //snack.stock -= qty;
      //await snack.save();
    }

    // 2. Calculate Order Financial Summary
    this._calculateOrderFinancials(orderData);

    let created_order = await Order.create(orderData);
    await PaymentService.updateOrderPayment(created_order.shopId);
    LineService.addOrder(created_order.lineId,created_order.shopId,created_order._id,created_order.totalPayableAmount);
    return Order.findById(created_order._id);
  }

  // READ: Fetch order by ID with populated references
  async getOrderById(orderId) {
    const order = await Order.findById(orderId)
      .populate('shopId', 'name ownerName ownerNumber address')
      .populate('items.snackId', 'name categoryId');
    
    if (!order) throw new NotFoundError('Order not found');
    return order;
  }

  // async function findShopsByLineId(lineId){
//     logger.debug({
//           "source":{"file":"shopServies","method":"findShopsByLineId"},
//           "req":lineId
//     })
//     const shops = await ShopModel.find({lineId:lineId},{})
// //     if(!shops){
// //             throw new NotFoundError(`shops with lineId ${lineId} not found`)
// //       }
//     logger.debug({
//           "source":{"file":"shopServies","method":"findShopsByLineId"},
//           "res":shops
//     })
//     return shops;
// }

// async function findShopsByLineName(lineName){
//     logger.debug({
//           "source":{"file":"shopServies","method":"findShopsByLineName"},
//           "req":lineName
//     })
//     const line = await findLineByName(lineName);
//     if(!line){
//             throw new NotFoundError(`line with name ${lineName} not found`)
//       }
//     const lineId = String(line._id);
//     const shops = await ShopModel.find({lineId:lineId},{})
// //     if(!shops){
// //             throw new NotFoundError(`shops with lineName ${lineName} not found`)
// //       }
//     logger.debug({
//           "source":{"file":"shopServies","method":"findShopsByLineName"},
//           "res":shops
//     })
//     return shops;
// }

  // READ: Fetch all orders with filtering and pagination
  async getAllOrders(filters = {}, page = 1, limit = 20) {
    return await Order.find(filters)
      .populate('shopId', 'name address')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  // UPDATE: Update top-level order details
  async updateOrder(orderId, updateData) {
    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    Object.assign(order, updateData);
    this._calculateOrderFinancials(order);

    return await order.save();
  }

  // DELETE: Delete an order record
  async deleteOrder(orderId) {
    return await Order.findByIdAndDelete(orderId);
  }

  // SPECIAL: Update Delivery Status
  async updateDeliveryStatus(orderId, status) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    order.deliveryStatus = status;
    return await order.save();
  }

  // SPECIAL: Cancel order and restore stock to inventory
  async cancelOrder(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.deliveryStatus === 'CANCELLED') throw new Error('Order is already cancelled');

    // Restock snacks
    for (let item of order.items) {
      const snack = await SnackService.SnackService(item.snackId); 
      await SnackService.updateSnack(item.snackId, { 
        stock: snack.stock+item.fulfilledQuantity
      });
    }

    order.deliveryStatus = 'CANCELLED';
    return await order.save();
  }

  // HELPER: Re-computes subtotal, taxes, discounts, & payment statuses
  _calculateOrderFinancials(order) {
    // 1. Calculate raw total from items
    order.totalAmount = order.items.reduce((sum, item) => sum + item.totalPrice, 0);

    // 2. Determine Discount
    let discountVal = order.discountAmount || 0;
    if (order.discountPct > 0) {
      discountVal = order.totalAmount * (order.discountPct / 100);
      order.discountAmount = discountVal;
    }

    const taxableAmount = Math.max(0, order.totalAmount - discountVal);

    // 3. Tax Calculation
    const taxPct = (order.sgstPct || 0) + (order.cgstPct || 0);
    const totalTax = taxableAmount * (taxPct / 100);

    // 4. Payable and Pending Amounts
    order.totalPayableAmount = order.totalPayableAmount || taxableAmount + totalTax;
    order.paidAmount = 0;
    order.pendingAmount = Math.max(0, order.totalPayableAmount - order.paidAmount);

    // 5. Align with Payment Status Enum: ['PAID', 'PARTIAL', 'NOT_PAID']
    if (order.pendingAmount === 0 && order.totalPayableAmount > 0) {
      order.paymentStatus = 'PAID';
    } else if (order.paidAmount > 0) {
      order.paymentStatus = 'PARTIAL';
    } else {
      order.paymentStatus = 'NOT_PAID';
    }
  }
}

module.exports = new OrderService();
// services/OrderItemService.js
const Order = require('../models/orderModel');
const Snack = require('../models/snackModel');
const OrderService = require('./orderService');

class OrderItemService {
  // CREATE: Add a line item to an existing order
  async addOrderItem(orderId, itemData) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    const snack = await Snack.findById(itemData.snackId);
    if (!snack) throw new NotFoundError('Snack item not found');

    const qty = itemData.orderedQuantity;
    if (snack.stock < qty) throw new Error('Insufficient snack stock available');

    itemData.unitPrice = itemData.unitPrice ?? snack.sellingPrice;
    itemData.fulfilledQuantity = itemData.fulfilledQuantity ?? qty;
    itemData.totalPrice = itemData.fulfilledQuantity * itemData.unitPrice;

    // Deduct stock
    snack.stock -= qty;
    await snack.save();

    order.items.push(itemData);
    OrderService._calculateOrderFinancials(order);

    return await order.save();
  }

  // UPDATE: Adjust item fulfillment quantity & status during handover
  async updateFulfillment(orderId, itemId, fulfilledQuantity, fulfillmentStatus = 'FULFILLED') {
    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new NotFoundError('Line item not found in order');

    const difference = item.fulfilledQuantity - fulfilledQuantity;
    
    item.fulfilledQuantity = fulfilledQuantity;
    item.fulfillmentStatus = fulfillmentStatus;
    item.totalPrice = item.fulfilledQuantity * item.unitPrice;

    // Return unfulfilled/rejected stock back to warehouse inventory
    if (difference > 0) {
      await Snack.findByIdAndUpdate(item.snackId, { $inc: { stock: difference } });
    } else if (difference < 0) {
      // If extra items were given, check and deduct stock
      await Snack.findByIdAndUpdate(item.snackId, { $inc: { stock: difference } });
    }

    OrderService._calculateOrderFinancials(order);
    return await order.save();
  }

  // DELETE: Remove an item completely from an order and restore stock
  async removeOrderItem(orderId, itemId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Line item not found');

    // Return fulfilled stock back to inventory
    await Snack.findByIdAndUpdate(item.snackId, { 
      $inc: { stock: item.fulfilledQuantity } 
    });

    order.items.pull(itemId);
    OrderService._calculateOrderFinancials(order);

    return await order.save();
  }
}

module.exports = new OrderItemService();
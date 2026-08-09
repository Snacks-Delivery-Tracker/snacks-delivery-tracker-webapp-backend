const express = require('express');
const router = express.Router();
const OrderService = require('../services/orderService');
const OrderItemService = require('../services/orderItemService');

// GET /api/orders - Get all orders ONLY
router.get('/', async (req, res, next) => {
  try {
    const orders = await OrderService.getAllOrders();
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/get-by-id - Fetch single order details via JSON body
router.post('/get-by-id', async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await OrderService.getOrderById(orderId);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/create - Create a new order
router.post('/create', async (req, res, next) => {
  try {
    const newOrder = await OrderService.createOrder(req.body);
    res.status(201).json({ success: true, data: newOrder });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/update - Update order details
router.post('/update', async (req, res, next) => {
  try {
    const { orderId, ...updateData } = req.body;
    const updatedOrder = await OrderService.updateOrder(orderId, updateData);
    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/update-delivery-status - Update order delivery status
router.post('/update-delivery-status', async (req, res, next) => {
  try {
    const { orderId, deliveryStatus } = req.body;
    const updatedOrder = await OrderService.updateDeliveryStatus(orderId, deliveryStatus);
    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/cancel - Cancel order & restore stock
router.post('/cancel', async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const cancelledOrder = await OrderService.cancelOrder(orderId);
    res.status(200).json({ success: true, message: 'Order cancelled successfully', data: cancelledOrder });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/delete - Delete order record
router.post('/delete', async (req, res, next) => {
  try {
    const { orderId } = req.body;
    await OrderService.deleteOrder(orderId);
    res.status(200).json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    next(error);
  }
});


// ==========================================
// 2. ORDER ITEM ROUTES (POST BODY OPERATIONS)
// ==========================================

// POST /api/v1/orders/items/add - Add item to existing order
router.post('/items/add', async (req, res, next) => {
  try {
    const { orderId, item } = req.body;
    const updatedOrder = await OrderItemService.addOrderItem(orderId, item);
    res.status(201).json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/orders/items/update-fulfillment - Update item fulfillment quantity/status
router.post('/items/update-fulfillment', async (req, res, next) => {
  try {
    const { orderId, itemId, fulfilledQuantity, fulfillmentStatus } = req.body;
    const updatedOrder = await OrderItemService.updateFulfillment(
      orderId,
      itemId,
      fulfilledQuantity,
      fulfillmentStatus
    );
    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/orders/items/remove - Remove item from order & restore stock
router.post('/items/remove', async (req, res, next) => {
  try {
    const { orderId, itemId } = req.body;
    const updatedOrder = await OrderItemService.removeOrderItem(orderId, itemId);
    res.status(200).json({ success: true, message: 'Line item removed', data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
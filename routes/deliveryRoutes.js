const express = require('express');
const asyncHandler = require('express-async-handler');
const DeliveryService = require('../services/deliveryService');

const router = express.Router();

router.post('/', asyncHandler(async (req, res) => {
  const delivery = await DeliveryService.createDelivery(req.body);
  res.status(201).json({ success: true, data: delivery });
}));

router.get('/shop/:shopId/history', asyncHandler(async (req, res) => {
  const history = await DeliveryService.getShopHistory(req.params.shopId);
  res.json({ success: true, data: history });
}));

router.get('/:orderId', asyncHandler(async (req, res) => {
  const delivery = await DeliveryService.getDelivery(req.params.orderId);
  res.json({ success: true, data: delivery });
}));

router.put('/:orderId', asyncHandler(async (req, res) => {
  const delivery = await DeliveryService.updateDelivery(req.params.orderId, req.body);
  res.json({ success: true, data: delivery });
}));

router.delete('/:orderId', asyncHandler(async (req, res) => {
  await DeliveryService.deleteDelivery(req.params.orderId);
  res.json({ success: true, message: 'Delivery deleted successfully' });
}));

module.exports = router;

const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');

// POST /api/payments/process - Pay pending orders using a lump sum
router.post('/process', async (req, res, next) => {
  try {
    const result = await PaymentService.processShopPayment(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/get-by-shop - Get all payments for a specific shop
router.post('/get-by-shop', async (req, res, next) => {
  try {
    const { shopId } = req.body;
    const payments = await PaymentService.getPaymentsByShop(shopId);
    res.status(200).json({ success: true, count: payments.length, data: payments });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
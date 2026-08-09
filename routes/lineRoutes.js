const express = require('express')
const router = express.Router()
const logger = require('../utils/logging')
const LineService = require('../services/lineService')
const asyncHandler = require("express-async-handler");
const validateBody = require("../middlewares/validateBody");
const Line = require('../models/lineModel');

/**
 * @route   POST /api/lines
 * @desc    Create a new Line
 */
router.post('/', async (req, res) => {
  try {
    const { lineName, deliveryDate } = req.body;

    if (!lineName) {
      return res.status(400).json({ error: 'lineName is required' });
    }

    const line = await LineService.createLine(lineName, deliveryDate);
    return res.status(201).json({ success: true, data: line });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/lines/:lineId/shops
 * @desc    Add a shop to a line (snapshots current balances)
 */
router.post('/shops', async (req, res) => {
  try {
    const lineId = req.body.lineId;
    const shopId = req.body.shopId;

    if (!shopId) {
      return res.status(400).json({ error: 'shopId is required' });
    }

    const updatedLine = await LineService.addShop(lineId, shopId);
    return res.status(200).json({ success: true, data: updatedLine });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/lines/:lineId
 * @desc    Get line details with populated shop references
 */
router.post('/find', async (req, res) => {
  try {
    const lineId= req.body.lineId;

    const line = await Line.findById(lineId);

    if (!line) {
      return res.status(404).json({ error: 'Line not found' });
    }

    return res.status(200).json({ success: true, data: line });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/close', async (req, res) => {
  try {
    const lineId= req.body.lineId;

    const line = await LineService.closeLine(lineId);

    if (!line) {
      return res.status(404).json({ error: 'Line not found' });
    }

    return res.status(200).json({ success: true, data: line });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
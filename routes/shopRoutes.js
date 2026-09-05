const express = require('express');
const routes = express.Router();
const logger = require('../utils/logging');
const NotFoundError = require("../utils/exceptions/NotFoundError");
const asyncHandler = require("express-async-handler");
const validateBody = require("../middlewares/validateBody");
const ShopModel = require('../models/shopModel');
const {
  createShop,
  findShopById,
  findShopsByName,
  updateShop,
  deleteShop
} = require('../services/shopServies');

// Get all / search shops
routes.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const filter = search
    ? { $or: [
      { name: { $regex: search, $options: 'i' } },
      { address: { $regex: search, $options: 'i' } }
    ] }
    : {};
  const shops = await ShopModel.find(filter).sort({ name: 1 }).limit(100);
  res.json({ success: true, data: shops });
}));

// Get shop by ID
routes.get('/:shopId', asyncHandler(async (req, res) => {
  const shop = await ShopModel.findById(req.params.shopId);
  if (!shop) throw new NotFoundError('Shop not found');
  res.json({ success: true, data: shop });
}));

// Update shop details
routes.put('/:shopId', asyncHandler(async (req, res) => {
  const shop = await updateShop(req.params.shopId, req.body);
  if (!shop) throw new NotFoundError('Shop not found');
  res.json({ success: true, data: shop });
}));

// Delete shop
routes.delete('/:shopId', asyncHandler(async (req, res) => {
  const deleted = await deleteShop(req.params.shopId);
  if (!deleted) throw new NotFoundError('Shop not found');
  res.json({ success: true, message: 'Shop deleted successfully' });
}));

// Create new shop
routes.post('/',
  validateBody(
    ["name", "ownerName", "ownerNumber", "address"],
    ["lineId", "name", "ownerName", "ownerNumber", "ownerEmail", "contactName", "contactNumber", "address"]
  ),
  asyncHandler(async (req, res) => {
    logger.debug({
      "source": { "file": "shopRoutes", "path": "/", "method": "post" },
      "req": req.body
    });
    const shop = await createShop(req.body);
    logger.debug({
      "source": { "file": "shopRoutes", "path": "/", "method": "post" },
      "res": { "status": 201, "body": shop }
    });
    res.status(201).json({ success: true, data: shop });
  })
);

// Find shops by query
routes.post('/find',
  validateBody(["findBy", "value"], ["findBy", "value"]),
  asyncHandler(async (req, res) => {
    logger.debug({
      "source": { "file": "shopRoutes", "path": "/find", "method": "post" },
      "req": req.body
    });
    let shops;
    switch (req.body.findBy) {
      case "name": shops = await findShopsByName(req.body.value); break;
      case "id": shops = await findShopById(req.body.value); break;
      default: throw new NotFoundError("Invalid findBy field");
    }
    logger.debug({
      "source": { "file": "shopRoutes", "path": "/find", "method": "post" },
      "res": { "body": shops }
    });
    res.json({ success: true, data: shops });
  })
);

module.exports = routes;

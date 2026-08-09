const express = require('express')
const routes = express.Router()
const logger = require('../utils/logging')
const NotFoundError = require("../utils/exceptions/NotFoundError")
const asyncHandler = require("express-async-handler");
const validateBody = require("../middlewares/validateBody");
const {createShop,
    findShopById,
    findShopsByName} = require('../services/shopServies')

//Create
/*
Demo 1
{
  "lineName":"A",
  "name": "akka's bhavan",
  "ownerName": "Ram Kumar",
  "ownerNumber": "9875644214",
  "ownerEmail": "ramKh@example.com",
  "address": "17, MG Road, Bengaluru, Karnataka - 560001"
}

Demo 2
{
  "name": "Raja's Hotel",
  "ownerName": "Jivan Pai",
  "ownerNumber": "4877641214",
  "ownerEmail": "jivan@example.com",
  "address": "13, MG Road, Bengaluru, Karnataka - 560001"
}

Demo 3
{
  "lineName":"A",
  "name": "Lakshman",
  "ownerName": "Babu",
  "ownerNumber": "9375201248",
  "ownerEmail": "lakshman@example.com",
  "address": "2 ,RK Road, Bengaluru, Karnataka - 560001"
}
*/
routes.post("/",
    validateBody(
    [
        "name",
        "ownerName",
        "ownerNumber",
        "address"
    ],
    [
        "lineId",
        "name",
        "ownerName",
        "ownerNumber",
        "ownerEmail",
        "contactName",
        "contactNumber",
        "address"
    ]
  ),
  asyncHandler(async (req, res) => {
    logger.debug({
        "source":{"file":"shopRoutes","path":"/","method":"post"},
        "req":req.body
    })
    const shop = await createShop(req.body);
    logger.debug({
        "source":{"file":"shopRoutes","path":"/","method":"post"},
        "res":{"status":201,"body":shop}
    })
    res.status(201).json(shop);
}));

//find shops
routes.post("/find",
    validateBody(
    ["findBy",
     "value"
    ],
    ["findBy",
     "value"]
  ),
  asyncHandler(async (req,res)=>{
    logger.debug({
      "source":{"file":"shopRoutes","path":"/find","method":"post"},
      "req":req.body
  })
  let shops
  switch(req.body.findBy){
    case "name":      shops = await findShopsByName(req.body.value);break;
    case "id":        shops = await findShopById(req.body.value);break;
    default: throw new NotFoundError("Invalid findBy field");
  }
  logger.debug({
      "source":{"file":"shopRoutes","path":"/find","method":"post"},
      "res":{"body":shops}
  })
  res.json(shops);

}))

module.exports = routes;
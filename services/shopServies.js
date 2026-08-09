const logger = require('../utils/logging')
const ShopModel = require('../models/shopModel')
const NotFoundError = require('../utils/exceptions/NotFoundError')

async function createShop(inp_shop){
    logger.debug({
          "source":{"file":"shopServies","method":"createShop"},
          "req":inp_shop
    })
    
    const saved_shop = await ShopModel.create(inp_shop);
    logger.debug({
          "source":{"file":"shopServies","method":"createShop"},
          "res":saved_shop
    })
    return saved_shop;
}

async function findShopById(shopId){
    logger.debug({
          "source":{"file":"shopServies","method":"findShopById"},
          "req":shopId
    })
    const shop = await ShopModel.find({_id:shopId},{})
    if(!shop){
            throw new NotFoundError(`shop with id ${shopId} not found`)
      }
    logger.debug({
          "source":{"file":"shopServies","method":"findShopById"},
          "res":shop
    })
    return shop;
}

async function findShopsByName(shopName){
    logger.debug({
          "source":{"file":"shopServies","method":"findShopsByName"},
          "req":shopName
    })
    const shops = await ShopModel.find({name:shopName},{})
//     if(!shops){
//             throw new NotFoundError(`shops with name ${shopName} not found`)
//       }
    logger.debug({
          "source":{"file":"shopServies","method":"findShopsByName"},
          "res":shops
    })
    return shops;
}

async function updateShop(id, shopData) {
    logger.debug({
          "source":{"file":"shopServies","method":"updateShop"},
          "req":{id:id,shopData:shopData}
    })
    const shop = await ShopModel.findByIdAndUpdate(
        id,
        shopData,
        {
          new: true,
            runValidators: true
        }
    );
    logger.debug({
          "source":{"file":"shopServies","method":"updateShop"},
          "res":shop
    })
    return shop;
}

async function deleteShop(id) {
  return await ShopModel.findByIdAndDelete(id);
}

module.exports = {
    createShop,
    findShopById,
    findShopsByName,
    updateShop,
    deleteShop,
}
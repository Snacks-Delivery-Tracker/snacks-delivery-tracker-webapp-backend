const logger = require('../utils/logging')
const { SnackModel } = require("../models/snackModel");

async function createSnack(snack) {
  logger.debug({
      "source":{"file":"snackServies","method":"createSnack"},
      "req":snack
    })
  const saved_snack = await SnackModel.create(snack)
  logger.debug({
      "source":{"file":"snackServies","method":"createSnack"},
      "res":saved_snack
    })
  return saved_snack;
}

async function findAllSnacks() {
  logger.debug({
      "source":{"file":"snackServies","method":"findAllSnacks"}
    })
  const snacks = await SnackModel.find();
  logger.debug({
      "source":{"file":"snackServies","method":"findAllSnacks"},
      "res":snacks
    })
  return snacks;
}

async function findSnackById(id) {
  logger.debug({
      "source":{"file":"snackServies","method":"findSnackById"},
      "req":id
    })
  const snack = await SnackModel.findById(id);
  logger.debug({
      "source":{"file":"snackServies","method":"findSnackById"},
      "res":snack
    })
  return snack;
}

async function findSnackByCategory(snackCategory) {
  logger.debug({
      "source":{"file":"snackServies","method":"findSnackByCategory"},
      "req":snackCategory
    })
  const snacks = await SnackModel.find({snackCategory:snackCategory},{})
  logger.debug({
      "source":{"file":"snackServies","method":"findSnackByCategory"},
      "res":snacks
    })
  return snacks;
}

async function findSnackByName(name) {
  logger.debug({
      "source":{"file":"snackServies","method":"findSnackByName"},
      "req":name
    })
  const snacks = await SnackModel.find({name:name},{});
  logger.debug({
      "source":{"file":"snackServies","method":"findSnackByName"},
      "res":snacks
    })
  return snacks;
}

async function updateSnack(id, snack) {
  logger.debug({
      "source":{"file":"snackServies","method":"updateSnack"},
      "req":{id:id,snack:snack}
    })
  const saved_snack = await SnackModel.findByIdAndUpdate(
      id,
      snack,
      {
        new: true,
        runValidators: true
      }
    );
  logger.debug({
      "source":{"file":"snackServies","method":"updateSnack"},
      "res":saved_snack
    })
  return saved_snack;
}

async function deleteSnack(id) {
  logger.debug({
      "source":{"file":"snackServies","method":"deleteSnack"},
      "req":{id:id,snack:snack}
    })
  const del_snack = await SnackModel.findByIdAndDelete(id);
  logger.debug({
      "source":{"file":"snackServies","method":"deleteSnack"},
      "res":del_snack
    })
  return del_snack;
}

module.exports = {
  createSnack,
  findAllSnacks,
  findSnackById,
  findSnackByName,
  findSnackByCategory,
  updateSnack,
  deleteSnack
};
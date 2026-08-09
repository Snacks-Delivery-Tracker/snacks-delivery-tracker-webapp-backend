const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const NotFoundError = require("../utils/exceptions/NotFoundError")
const validateBody = require("../middlewares/validateBody");

const {
  createSnack,
  findAllSnacks,
  findSnackById,
  findSnackByName,
  findSnackByCategory,
  updateSnack,
  deleteSnack
} = require("../services/snackServies");

// Create
router.post("/",
  validateBody(
    [
      "name",
      "stock",
      "acquiringPrice",
      "mrp",
      "sellingPrice"
    ],
     [
      "snackCategory",
      "name",
      "imgUrl",
      "stock",
      "isAvailable",
      "acquiringPrice",
      "mrp",
      "discountPct",
      "sellingPrice"
    ]
  ),
   asyncHandler(async (req, res) => {
    const snack = await createSnack(req.body);
    res.status(201).json(snack);
}));

// Get all
router.get("/", validateBody([],[]),asyncHandler(async (req, res) => {
    const snacks = await findAllSnacks();
    res.json(snacks);
}));

// find by field
router.post("/find", 
  validateBody(
      ["findBy",
       "value"
      ],
      ["findBy",
       "value"]
    ), 
  asyncHandler(async (req, res) => {

    let snacks;
    switch(req.body.findBy){
        case "id":      snacks = await findSnackById(req.body.value); break;
        case "name":    snacks = await findSnackByName(req.body.value); break;
        case "category":snacks = await findSnackByCategory(req.body.value);break;
        default: throw new NotFoundError("Invalid findBy field");
    }

    if (!snacks) {
      throw new NotFoundError("Snack not found" );
    }

    res.json(snacks);
}));

// Update
router.put("/",
  validateBody(
      ["id",
       "name",
       "stock",
       "acquiringPrice",
       "mrp",
       "sellingPrice"
      ],
      [
        "id",
        "snackCategory",
        "name",
        "imgUrl",
        "stock",
        "isAvailable",
        "acquiringPrice",
        "mrp",
        "discountPct",
        "sellingPrice"
      ]
    ),
    asyncHandler(async (req, res) => {
    const snack = await updateSnack(req.body.id, req.body);

    if (!snack) {
      throw new NotFoundError("Snack not found" );
    }

    res.json(snack);
}));

// Delete
router.delete("/",validateBody(["id"],["id"]), asyncHandler(async (req, res) => {
    const snack = await deleteSnack(req.body.id);
    if (!snack) {
      throw new NotFoundError("Snack not found" );
    }

    res.json({ message: "Snack deleted successfully" });
}));

module.exports = router;
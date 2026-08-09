const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const round2 = (v) => (typeof v === 'number' ? Math.round((v + Number.EPSILON) * 100) / 100 : v);
const OrderItemSchema = new Schema({
  snackId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Snack', 
    required: true 
  },
  orderedQuantity: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  fulfilledQuantity: { 
    type: Number, 
    required: true,
    min: 0,
    default: function() {
      return this.orderedQuantity;
    }
  },
  fulfillmentStatus: {
    type: String,
    enum: ['PENDING', 'FULFILLED', 'PARTIALLY_FULFILLED', 'REJECTED', 'DAMAGED'],
    default: 'PENDING'
  },
  unitPrice: { 
    type: Number, 
    required: true, 
    min: 0,
    set: round2
  },

  totalPrice: { 
    type: Number, 
    required: true, 
    min: 0,
    set: round2
  },
}, { _id: true });

OrderItemModel = new model("OrderItem",OrderItemSchema);
module.exports={OrderItemSchema,OrderItemModel};
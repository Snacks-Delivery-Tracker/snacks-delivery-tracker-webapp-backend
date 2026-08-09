const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const {OrderItemSchema} = require('./orderItemModel')
const round2 = (v) => (typeof v === 'number' ? Math.round((v + Number.EPSILON) * 100) / 100 : v);

const OrderSchema = new Schema({
  lineId: {
    type: Schema.Types.ObjectId, 
    ref: 'Line', 
    required: true 
  },
  shopId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Shop', 
    required: true 
  },
  orderDate: { 
    type: Date, 
    default: Date.now 
  },
  items: [OrderItemSchema], // Embedded line items array
  totalAmount: { 
    type: Number, 
    required: true, 
    default: 0,
    set: round2
  },
  // OPTION A: Discount percentage applied to this line item
  discountPct: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 100 
  },
  
  // OPTION B: Direct monetary discount amount (per unit OR total for the item batch)
  discountAmount: { 
    type: Number, 
    default: 0, 
    min: 0,
    set: round2
  },
  sgstPct: { 
    type: Number, 
    default: 0 
  },
  cgstPct: { 
    type: Number, 
    default: 0 
  },
  totalPayableAmount: { 
    type: Number, 
    required: true,
    min:0,
    set: round2
  },
  paidAmount: { 
    type: Number, 
    default: 0,
    min:0,
    set: round2
  },
  pendingAmount: { 
    type: Number, 
    required: true,
    min:0,
    set: round2 
  },
  paymentStatus: { 
    type: String, 
    enum: ['PAID', 'PARTIAL', 'NOT_PAID'], 
    default: 'NOT_PAID' 
  },
  deliveryStatus: {
    type: String,
    enum: [
      'PENDING', 
      'DISPATCHED', 
      'DELIVERED', 
      'PARTIALLY_DELIVERED', 
      'FAILED', 
      'CANCELLED'
    ],
    default: 'PENDING',
    index: true // Indexed for fast filtering on delivery app/dashboard
  },
}, { timestamps: true });

module.exports = model('orderSchema', OrderSchema);
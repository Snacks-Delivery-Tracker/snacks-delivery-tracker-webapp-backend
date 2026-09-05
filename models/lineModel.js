const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const round2 = (v) => (typeof v === 'number' ? Math.round((v + Number.EPSILON) * 100) / 100 : v);

const ShopLineSummarySchema = new Schema({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  
  // 1. Initial State (Captured when Line starts)
  startingOutstanding: { type: Number, set: round2, default: 0 },
  startingCredit: { type: Number, set: round2, default: 0 },

  // 2. Line Run Activity (Recorded during delivery)
  ordersDeliveredAmount: { type: Number, set: round2, default: 0 },
  paymentsCollected: { type: Number, set: round2, default: 0 },
  
  // Optional audit references
  orderIds: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
  paymentIds: [{ type: Schema.Types.ObjectId, ref: 'Payment' }],

  // 3. Final State (Captured on closeLine)
  endingOutstanding: { type: Number, set: round2, default: 0 },
  endingCredit: { type: Number, set: round2, default: 0 }
}, { _id: false });

const LineSchema = new Schema({
  lineName: { type: String, required: true },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  deliveryDate: { type: Date, default: Date.now, index: true },
  startTime: Date,
  endTime: Date,

  // Per-shop tracking
  shops: [ShopLineSummarySchema],

  // Line Totals (Calculated automatically when line is closed)
  totalCashCollected: { type: Number, set: round2, default: 0 },
  totalGoodsDelivered: { type: Number, set: round2, default: 0 }
}, { timestamps: true });

module.exports = model('Line', LineSchema);

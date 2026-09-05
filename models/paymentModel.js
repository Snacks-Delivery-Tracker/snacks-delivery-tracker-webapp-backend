const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const round2 = (v) => (typeof v === 'number' ? Math.round((v + Number.EPSILON) * 100) / 100 : v);

const AllocationSchema = new Schema({
  orderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'orderSchema', 
    required: true 
  },
  allocatedAmount: { 
    type: Number, 
    required: true, 
    min: 0,
    set: round2 
  }
}, { _id: false });

const PaymentSchema = new Schema({
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
  // The delivery that recorded this collection. Allocations can still settle
  // older invoices first, but this lets the delivery UI show its own entry.
  sourceOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'orderSchema'
  },
  amountPaid: { 
    type: Number, 
    required: true, 
    min: 0,
    set: round2 
  },
  unallocatedAmount: { 
    type: Number, 
    default: 0, 
    min: 0,
    set: round2
  },
  allocations: [AllocationSchema],
  paymentMode: { 
    type: String, 
    enum: ['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER'], 
    required: true 
  },
  paymentDate: { 
    type: Date, 
    default: Date.now 
  },
  transactionRef: { 
    type: String, 
    trim: true // Cheque number or UPI transaction ID
  },
  notes: { 
    type: String 
  }
}, { timestamps: true });

module.exports = model('payment', PaymentSchema);

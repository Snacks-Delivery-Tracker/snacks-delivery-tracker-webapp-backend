const mongoose = require('mongoose')
const { Schema,model } = mongoose;
const round2 = (v) => (typeof v === 'number' ? Math.round((v + Number.EPSILON) * 100) / 100 : v);

const ShopSchema = new Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  ownerName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  ownerNumber: { 
    type: String, 
    required: true, 
    trim: true 
  },
  ownerEmail: { 
    type: String, 
    lowercase: true, 
    trim: true 
  },
  contactName: { 
    type: String, 
    trim: true 
  },
  contactNumber: { 
    type: String, 
    trim: true 
  },
  address: { 
    type: String, 
    required: true 
  },
  // Total pending money owed by the shop across all unpaid orders
  totalOutstandingBalance: { 
    type: Number, 
    default: 0, 
    min: 0,
    set: round2
  },
  // Advance credit money available from past overpayments
  creditBalance: { 
    type: Number, 
    default: 0, 
    min: 0,
    set: round2 
  }
}, { timestamps: true });

const ShopModel = new model("Shop",ShopSchema);

module.exports=ShopModel
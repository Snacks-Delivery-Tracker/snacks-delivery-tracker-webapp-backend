const mongoose = require('mongoose')
const { Schema, model } = mongoose;
const SNACK_CATEGORIES = require('./snackCategory');
const round2 = (v) => (typeof v === 'number' ? Math.round((v + Number.EPSILON) * 100) / 100 : v);

const SnackSchema = new Schema({
  snackCategory: { 
    type: String,
    enum: SNACK_CATEGORIES
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  imgUrl: { 
    type: String, 
    default: '' 
  },
  stock: { 
    type: Number, 
    required: true, 
    min: 0, 
    default: 0 
  },
  isAvailable: { 
    type: Boolean, 
    default: true 
  },
  acquiringPrice: { 
    type: Number, 
    required: true, 
    min: 0,
    set: round2 
  },
  mrp: { 
    type: Number, 
    required: true, 
    min: 0,
    set: round2 
  },
  sellingPrice: { 
    type: Number, 
    required: true, 
    min: 0,
    set: round2 
  }
}, { timestamps: true });

const SnackModel = new model("Snack",SnackSchema);
module.exports={SnackModel}
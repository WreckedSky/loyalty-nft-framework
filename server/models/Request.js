const mongoose = require('mongoose');
const requestSchema = new mongoose.Schema({
  type: { type: String, enum: ['mint','payment'] },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Request', requestSchema);
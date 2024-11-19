const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  score: { type: Number, default: 0 },
  lastPlayed: { type: Date },
  chainDays: { type: Number, default: 0 },
  nextClickAvailable: { type: Date },
  isGuest: { type: Boolean, default: false }  // Add this line
});

module.exports = mongoose.model('User', userSchema);
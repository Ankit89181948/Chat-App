// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true }, // set unique: true if you want uniqueness
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

// To avoid “OverwriteModelError” in dev hot-reloads:
module.exports = mongoose.models.Users || mongoose.model('Users', userSchema);

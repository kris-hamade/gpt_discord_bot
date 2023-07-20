const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChatConfigSchema = new Schema({
  username: { type: String, required: true, unique: true },
  currentPersonality: { type: String, default: "haggle" },
  model: { type: String, default: "gpt-4" },
  temperature: { type: Number, default: 1 },
}, { timestamps: true, collection: 'chatConfig' });

module.exports = mongoose.model('ChatConfig', ChatConfigSchema);

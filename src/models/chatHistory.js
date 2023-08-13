const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatHistorySchema = new Schema({
  type: String,
  username: String,
  content: String,
  requestor: String,
  timestamp: String,
  channelId: String,
}, { collection: 'chatHistory' });

// Create a compound index on username and channelId to ensure their combination is unique
chatHistorySchema.index({ requestor: 1, channelId: 1 }, { unique: true });

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

module.exports = ChatHistory;
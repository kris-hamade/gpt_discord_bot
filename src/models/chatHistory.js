const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatHistorySchema = new Schema({
  type: String,
  username: String,
  content: String,
  requestor: String,
  timestamp: String
}, { collection: 'chatHistory' });

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

module.exports = ChatHistory;
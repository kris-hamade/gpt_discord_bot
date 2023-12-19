const mongoose = require('mongoose');
const moment = require("moment");
const ChatHistory = require('../models/chatHistory');

async function buildHistory(type, username, content, requestor, channelId) {
  let timestamp = getCurrentTimestamp();
  try {
    const chatHistory = new ChatHistory({ type, username, content, requestor, timestamp, channelId });
    await chatHistory.save();
    return chatHistory;
  } catch (error) {
    console.error("Error building history:", error);
    throw error;
  }
}

async function getHistoryJson(size) {
  try {
    if (size === "complete") {
      const allHistory = await ChatHistory.find();
      return allHistory;
    }
  } catch (error) {
    console.error("Error getting history JSON:", error);
    throw error;
  }
}

async function getHistory(nickname, personality, channelId) {
  if (!channelId) {
    console.error("getHistory called with undefined channelId");
    return "Error: channelId is undefined";
  }
  try {
    console.log(`getHistory called with nickname=${nickname}, personality=${personality}, channelId=${channelId}`);

    // Fetching complete chat history
    const historyDocs = await ChatHistory.find({
      $or: [
        { requestor: nickname, username: nickname, channelId: channelId },
        { type: "assistant", username: personality, channelId: channelId }
      ]
    });

    console.log("Complete chat history fetched:", historyDocs);

    // Format and return the chat history
    const formattedHistory = formatChatHistory(historyDocs);
    console.log("Formatted chat history:", formattedHistory);
    return formattedHistory;
  } catch (error) {
    console.error("Error getting history:", error);
    throw error;
  }
}



function formatChatHistory(chatHistory) {
  return chatHistory
    .map((item) => {
      if (item.type === "user") {
        return `User: ${item.username}\n${item.content}`;
      } else if (item.type === "assistant") {
        return `Assistant: ${item.content}`;
      }
    })
    .join("\n");
}


async function clearUsersHistory(nickname, channelId) {
  try {
    await ChatHistory.deleteMany({
      $or: [
        { username: nickname },
        { requestor: nickname },
        { channelId: channelId }
      ]
    });
  } catch (error) {
    console.error(`Error clearing history for ${nickname} in chatHistory collection:`, error);
    throw error;
  }
}

async function clearAllHistory() {
  try {
    await ChatHistory.deleteMany({});
  } catch (error) {
    console.error("Error clearing ChatHistory collection:", error);
    throw error;
  }
}

function getCurrentTimestamp() {
  return moment().format("YYYYMMDD-HH:mm:ss");
}

module.exports = {
  buildHistory,
  clearAllHistory,
  clearUsersHistory,
  getHistory,
};
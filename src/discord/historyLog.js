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
    } else {
      //... your size-limited retrieval logic ...
    }
  } catch (error) {
    console.error("Error getting history JSON:", error);
    throw error;
  }
}

async function getHistory(size, nickname, personality, channelId) {
  try {
    let historyDocs;
    if (size === "complete") {
      // Get all chat history related to the requester and personality from MongoDB
      historyDocs = await ChatHistory.find({
        $or: [
          {requestor: nickname, username: nickname, channelId: channelId},
          {type: "assistant", username: personality, channelId: channelId}
        ]
      });
    } else {
      let remainingSize = size;
      let output = [];

      // Get all chat history related to the requester and personality from MongoDB in reverse order (latest first)
      const allHistory = await ChatHistory.find({
        $or: [
          {requestor: nickname, username: nickname, channelId: channelId},
          {type: "assistant", username: personality, channelId: channelId}
        ]
      }).sort({_id: -1});

      for (const item of allHistory) {
        const itemJsonString = JSON.stringify(item);
        const itemLength = itemJsonString.length;

        if (itemLength <= remainingSize) {
          output.push(item);
          remainingSize -= itemLength;
        } else {
          break;
        }
      }

      output.reverse(); // Reverse the output array to maintain the original order
      historyDocs = output;
    }

    // Format and return the chat history
    return formatChatHistory(historyDocs);
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
        {username: nickname},
        {requestor: nickname},
        {channelId: channelId}
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
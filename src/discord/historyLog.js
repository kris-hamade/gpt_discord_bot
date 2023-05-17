const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Read the file and parse the JSON
const historyFile = path.join('.', 'src', 'utils', 'data-misc', 'chathistory.json');
const historyContent = fs.readFileSync(historyFile, 'utf-8');
let chatHistory = JSON.parse(historyContent);

async function buildHistory(type, username, content, requestor) {
  let timestamp = getCurrentTimestamp();
  try {
    chatHistory.push({
      type,
      username,
      content,
      requestor,
      timestamp
    });

    // Convert the updated chatHistory array back to a JSON string
    const updatedChatHistoryJson = JSON.stringify(chatHistory, null, 2);

    // Save the updated chatHistory back to the JSON file
    fs.writeFileSync(historyFile, updatedChatHistoryJson, 'utf-8');
    return chatHistory;
  } catch (error) {
    console.error("Error building history:", error);
    return error
  }
}

async function getHistoryJson(size) {
  if (size === "complete") {
    return chatHistory;
  } else {
    let remainingSize = size;
    let output = [];

    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const item = chatHistory[i];
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
    return output;
  }
}

async function getHistory(size, nickname, personality) {
  if (size === "complete") {
    const fullHistory = formatChatHistory(chatHistory);
    return fullHistory.filter(item => (item.requestor === nickname || item.username === nickname) && (item.type === 'assistant' || item.username === personality));
  } else {
    let remainingSize = size;
    let output = [];

    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const item = chatHistory[i];

      // Only consider items related to the requester and personality
      if ((item.requestor !== nickname && item.username !== nickname) || (item.type === 'assistant' && item.username !== personality)) {
        continue;
      }

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
    return formatChatHistory(output.filter(item => (item.requestor === nickname || item.username === nickname) && (item.type === 'assistant' || item.username === personality)));
  }
}


function formatChatHistory(chatHistory) {
  return chatHistory.map(item => {
    if (item.type === "user") {
      return `User: ${item.username}\n${item.content}`;
    } else if (item.type === "assistant") {
      return `Assistant: ${item.content}`;
    }
  }).join('\n');
}

async function clearUsersHistory(nickname) {
  return new Promise((resolve, reject) => {
    // Filter out the history for the provided nickname
    chatHistory = chatHistory.filter(item => item.username !== nickname && item.requestor !== nickname);
    
    // Convert the remaining chat history to JSON
    const json = JSON.stringify(chatHistory);
    
    // Write the updated chat history to the file
    fs.writeFile(historyFile, json, 'utf8', (err) => {
      if (err) {
        console.error(`Error clearing history for ${nickname} in chathistory.json:`, err);
        reject(err);
      } else {
        console.log(`History for ${nickname} cleared in chathistory.json.`);
        resolve();
      }
    });
  });
}


async function clearAllHistory() {
  return new Promise((resolve, reject) => {
    chatHistory = [];
    fs.writeFile(historyFile, '[]', 'utf8', (err) => {
      if (err) {
        console.error('Error clearing chathistory.json:', err);
        reject(err);
      } else {
        console.log('chathistory.json cleared.');
        resolve();
      }
    });
  });
}

function getCurrentTimestamp() {
  return moment().format('YYYYMMDD-HH:mm:ss');
}

module.exports = {
  buildHistory,
  clearAllHistory,
  clearUsersHistory,
  getHistory
};
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Read the file and parse the JSON
const historyFile = path.join('.', 'src', 'utils', 'data-misc', 'chathistory.json');
const historyContent = fs.readFileSync(historyFile, 'utf-8');
let chatHistory = JSON.parse(historyContent);

async function buildHistory(type, username, content) {
    let timestamp = getCurrentTimestamp();
    try {
        chatHistory.push({
            type,
            username,
            content,
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

async function getHistory(size) {
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

async function clearHistory() {
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
    clearHistory,
    getHistory
};
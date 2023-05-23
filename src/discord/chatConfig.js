const fs = require('fs');
const path = require('path');

// Read the file and parse the JSON
const chatConfigFile = path.join('.', 'src', 'utils', 'data-misc', 'chatconfig.json');
let chatConfig = JSON.parse(fs.readFileSync(chatConfigFile, 'utf-8'));

async function getChatConfig(username) {
    // Reload the file
    chatConfig = JSON.parse(fs.readFileSync(chatConfigFile, 'utf-8'));
    
    // Check if the user's config exists, if not, create a default one
    if (!chatConfig[username]) {
        chatConfig[username] = {
            "currentPersonality": "haggle",
        };

        // Save the updated config back to the file
        await fs.promises.writeFile(chatConfigFile, JSON.stringify(chatConfig, null, 2));
    }
    console.log(chatConfig[username]);
    return chatConfig[username];
}

async function setChatConfig(username, config) {
    // Reload the file
    chatConfig = JSON.parse(fs.readFileSync(chatConfigFile, 'utf-8'));
    
    // Overwrite the user's config
    chatConfig[username] = config;
    console.log(chatConfig[username]);
    
    // Save the updated config back to the file
    await fs.promises.writeFile(chatConfigFile, JSON.stringify(chatConfig, null, 2));
}

module.exports = {
    getChatConfig,
    setChatConfig
}

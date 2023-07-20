const fs = require('fs');
const path = require('path');
const db = require('../utils/db');


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
            "model": "gpt-4",
            "temperature": 1
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
    
    // Sets GPT version to gpt-3.5-Turbo-16k if the model is any version of gpt-3
    chatConfig[username].model = chatConfig[username].model.includes("gpt-3") ? "gpt-3.5-turbo-16k" : chatConfig[username].model;

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

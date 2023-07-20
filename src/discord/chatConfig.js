const ChatConfig = require('../models/ChatConfig');

async function getChatConfig(username) {
    let chatConfig = await ChatConfig.findOne({ username });
    
    // Check if the user's config exists, if not, create a default one
    if (!chatConfig) {
        chatConfig = new ChatConfig({ username });
        await chatConfig.save();
    }
    
    console.log(chatConfig);
    return chatConfig;
}

async function setChatConfig(username, config) {
    // Find the user's config
    let chatConfig = await ChatConfig.findOne({ username });

    // If the config doesn't exist, create a new one
    if (!chatConfig) {
        chatConfig = new ChatConfig({ username });
    }
    
    // Sets GPT version to gpt-3.5-Turbo-16k if the model is any version of gpt-3
    config.model = config.model.includes("gpt-3") ? "gpt-3.5-turbo-16k" : config.model;

    // Overwrite the user's config
    chatConfig.currentPersonality = config.currentPersonality;
    chatConfig.model = config.model;
    chatConfig.temperature = config.temperature;
    
    await chatConfig.save();
    console.log(chatConfig);
}

module.exports = {
    getChatConfig,
    setChatConfig
}

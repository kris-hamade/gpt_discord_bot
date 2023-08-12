const ChatConfig = require('../models/chatConfig');

async function getChatConfig(username, channelID) {
    console.log("getChatConfig channel ID:", channelID)
    let chatConfig = await ChatConfig.findOne({ username, channelID });

    // Check if the user's config exists, if not, create a default one
    if (!chatConfig) {
        chatConfig = new ChatConfig({ username, channelID });
        await chatConfig.save();
    }

    console.log(chatConfig);
    return chatConfig;
}

async function setChatConfig(username, config, channelID) {
    console.log("channel ID:", channelID)
    // Find the user's config
    let chatConfig = await ChatConfig.findOne({ username, channelID });

    // If the config doesn't exist, create a new one
    if (!chatConfig) {
        chatConfig = new ChatConfig({ username, channelID });
    }

    // Sets GPT version to gpt-3.5-Turbo-16k if the model is any version of gpt-3
    if (config.model && config.model.includes("gpt-3")) {
        chatConfig.model = "gpt-3.5-turbo-16k";
    } else if (config.model) {
        chatConfig.model = config.model;
    }

    if (config.currentPersonality) {
        chatConfig.currentPersonality = config.currentPersonality;
    }

    if (config.temperature) {
        chatConfig.temperature = config.temperature;
    }

    await chatConfig.save();
    console.log(chatConfig);
}

module.exports = {
    getChatConfig,
    setChatConfig
}

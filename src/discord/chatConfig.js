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
    console.log("channel ID:", channelID);
    let chatConfig = await ChatConfig.findOne({ username, channelID });

    if (!chatConfig) {
        // If the config doesn't exist, create a new one
        chatConfig = new ChatConfig({ username, channelID });
    }

    // Update the model based on the provided config
    if (config.model) {
        if (config.model.includes("gpt-3")) {
            // If the model contains "gpt-3", update it to "gpt-3.5-turbo-1106"
            chatConfig.model = "gpt-3.5-turbo-1106";
        } else if (config.model.includes("gpt-4")) {
            // If the model contains "gpt-4", update it to "gpt-4-turbo"
            // This will also catch any "gpt-4" models and update them to "gpt-4-turbo"
            chatConfig.model = "gpt-4-turbo";
        } else {
            // If the model is something else, set it directly
            chatConfig.model = config.model;
        }
    }

    // Update other configurations
    if (config.currentPersonality) {
        chatConfig.currentPersonality = config.currentPersonality;
    }
    if (config.temperature) {
        chatConfig.temperature = config.temperature;
    }

    // Save the updated config
    await chatConfig.save();
    console.log(chatConfig);
}


module.exports = {
    getChatConfig,
    setChatConfig
}

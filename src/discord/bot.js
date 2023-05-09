const Discord = require('discord.js');
const {
    personas
} = require('../utils/data-misc/personas');
const {
    generateResponse
} = require('../openai/gpt');
const {
    preprocessUserInput
} = require('../utils/preprocessor');
const {
    buildHistory,
    clearHistory
} = require('./historyLog');
const {
    getConfigInformation,
    getUptime,
    setGptModel,
    setGptTemperature
} = require('../utils/data-misc/config');

// Create a new Discord client
const client = new Discord.Client({
    intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.MessageContent],
});

// required persona vars 
let currentPersonality = "haggle";
const personalities = {
    "haggle": personas.haggle,
    "assistant": personas.assistant
};

async function handleMessage(message) {
    // Ignore messages from other bots
    if (message.author.bot || !(message.mentions.has(client.user.id))) return;

    // get nickname of membor author and trim dicord user code string from message.
    const nickname = message.member.nickname || message.author.username;
    message.content = message.content.replace(/<@[!&]?\d+>/g, "").trim();

    // Discord bot commands
    const cmdForget = "/forget"
    const cmdPersona = "/persona"
    const cmdSetGptModel = "/model"
    const cmdSetGptTemp = "/temp"
    const cmdGetUptime = "/uptime"
    const cmdAbout = "/about"

    // Show as typing in the discord channel
    message.channel.sendTyping();

    // command to change persona if the message starts with /persona
    if (message.content.startsWith(cmdPersona)) {

        // split message content to find args
        const args = message.content.split(" ");
        if (args.length > 1) { // should be command + persona name (two args)
            const personalityName = args[1].toLowerCase();

            // Check persona to see if it's a valid key in 'personalities'.
            if (Object.keys(personalities).includes(personalityName)) {
                currentPersonality = personalityName;
                message.reply(`Switched to persona ${personalityName}.`);

            } else {
                // List the available personas since they chose an incorrect one.
                message.reply(`Invalid persona: ${personalityName}. \n Use one of these\n  ${Object.keys(personalities).join("\n  ")}`);
            }
        } else {
            message.reply(`Usage: ${cmdPersona} <persona>`);
        } // help msg
        return;
    }

    // Command to change GPT model
    if (message.content.startsWith(cmdSetGptModel)) {
        const args = message.content.split(" ");
        if (args.length > 1) {
            const newModel = args[1].toLowerCase();
            const result = setGptModel(newModel);
            message.reply(result.message);
        } else {
            message.reply(`Usage: ${cmdSetGptModel} <model>`);
        }
        return;
    }

    // Command to change GPT temperature
    if (message.content.startsWith(cmdSetGptTemp)) {
        const args = message.content.split(" ");
        if (args.length > 1) {
            const newTemp = args[1].toLowerCase();
            const result = setGptTemperature(newTemp);
            message.reply(result.message);
        } else {
            message.reply(`Usage: ${cmdSetGptTemp} <temp>`);
        }
        return;
    }

    // Command to get uptime of the bot
    if (message.content.startsWith(cmdGetUptime)) {
        const uptime = getUptime();
        message.reply(`Uptime: ${uptime}`);
        return;
    }

    // Command to get configuration information about the bot. Version, GPT model, etc.
    if (message.content.startsWith(cmdAbout)) {
        const configInfo = getConfigInformation();
        message.reply(configInfo);
        return;
    }
    // command to clear chat history
    if (message.content.includes(cmdForget)) {
        clearHistory()
            .then(() => {
                message.reply("-- Memory Erased --"); // tell user memory was erased
            })
            .catch((err) => {
                message.reply("Unable to erase memory");
            });

        return;
    }

    // Preprocess Message and Return Data from our DnD Journal / Sessions
    // Also sends user nickname to retrieve data about their character
    if (message.content !== "") {
        dndData = await preprocessUserInput(message.content, nickname)
    }

    // interaction with ChatGPT API starts here.
    try {

        // generate response from ChatGPT API
        let responseText = await generateResponse(message.content, personalities[currentPersonality], dndData, nickname);

        // trim persona name from response text if it exists.
        responseText = responseText.replace(new RegExp(`${currentPersonality}: |\\(${currentPersonality}\\) `, 'gi'), "");

        //Chat History Use and Manipulation
        // Add the latest user message to the chat history
        buildHistory("user", nickname, message.content)

        //Add GPT Response to Chat History
        buildHistory("assistant", currentPersonality, responseText)

        // print trimmed response to discord
        return message.reply(responseText);
    } catch (err) {
        console.log(err.message);
        return message.reply("Unable to Generate Response");
    }
}

function start() {
    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
    });
    client.on('messageCreate', handleMessage);

    client.login(process.env.DISCORD_TOKEN);
}

module.exports = {
    start
};
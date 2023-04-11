const Discord = require('discord.js');
const {
    personas
} = require('../openai/personas');
const {
    generateResponse
} = require('../openai/gpt4');

const client = new Discord.Client({
    intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.MessageContent],
});

// required persona vars 
let currentPersonality = "haggle";
const chatHistory = [];
const maxHistory = 4
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

    // commands
    const cmdForget = "/forget"
    const cmdPersona = "/persona"

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
                chatHistory.length = 0;
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

    // command to clear chat history
    if (message.content.includes(cmdForget)) {
        chatHistory.length = 0; // Purge the chat history
        chatHistory.push({
            role: "assistant",
            content: "I will stay in character from now on."
        });
        message.reply("-- Memory Erased --"); // tell user memory was erased
        return;
    }
    // interaction with ChatGPT API starts here.
    try {
        // Add the latest user message to the chat history and prepend From (discordusernickname): to help it identify users.
        chatHistory.push({
            role: "user",
            content: `From ${nickname}: ${message.content}`
        });

        // generate response from ChatGPT API
        let responseText = await generateResponse(message.content, personalities[currentPersonality]);

        // trim persona name from response text if it exists.
        responseText = responseText.replace(new RegExp(`${currentPersonality}: |\\(${currentPersonality}\\) `, 'gi'), "");

        //store trimmed responses in an assistant role for ChatGPT recollection.
        chatHistory.push({
            role: "assistant",
            content: responseText
        });

        // Only keep the last few messages in the chat history. Trims oldest. 
        while (chatHistory.length > maxHistory) {
            chatHistory.shift();
        }

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
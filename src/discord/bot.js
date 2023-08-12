const Discord = require("discord.js");
const { generateEventData, generateImage, generateImageResponse, generateResponse } = require("../openai/gpt");
const { preprocessUserInput } = require("../utils/preprocessor");
const {
  buildHistory,
  clearAllHistory,
  clearUsersHistory,
} = require("./historyLog");
const {
  getConfigInformation,
  getUptime,
} = require("../utils/data-misc/config");
const { getChatConfig, setChatConfig } = require("./chatConfig");
const { deleteEvent, loadJobsFromDatabase } = require("../utils/eventScheduler");
const ScheduledEvent = require('../models/scheduledEvent');
const moment = require('moment-timezone');
const cronstrue = require('cronstrue');
const axios = require('axios');
const Personas = require('../models/personas');
const { getImageDescription } = require('../utils/vision');

// Include the required packages for slash commands
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// Create a new Discord client
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.DirectMessages,
    Discord.GatewayIntentBits.DirectMessageReactions,
    Discord.GatewayIntentBits.DirectMessageTyping,
  ],
});

async function handleMessage(message) {
  let nickname = message.guild ? (message.member ? message.member.nickname || message.author.username : message.author.username) : message.author.username;

  console.log(`Received a message from ${nickname} in ${message.channelId}`);

  // Ignore messages from other bots
  if (message.author.bot) return;

  // Skip mention check in DMs
  if (
    !(message.channel instanceof Discord.DMChannel) &&
    !message.mentions.has(client.user.id)
  )
    return;

  // ============================ Image Processing =============================
  let imageDescription;

  // If there's an attachment with a URL
  if (message.attachments.size > 0 && message.attachments.first().url) {
    console.log(`processing ${message.attachments.first().url}`);
    imageFullDescription = await getImageDescription(message.attachments.first().url);
    imageDescription = imageFullDescription.denseCaptions.join(", ");
    console.log(imageDescription);
  }


  // If an image URL is found in the message content
  const imgUrlPattern = /https?:\/\/[^ "]+\.(?:png|jpg|jpeg|gif)/; // Adjust this regex pattern as needed
  if (imgUrlPattern.test(message.content)) {
    const imgUrl = message.content.match(imgUrlPattern)[0];
    console.log(`processing ${imgUrl}`);
    imageFullDescription = await getImageDescription(imgUrl);
    imageDescription = imageFullDescription.denseCaptions.join(", ");
    console.log(imageDescription);

    // Remove the detected image URL from the message content
    message.content = message.content.replace(imgUrlPattern, '').trim();
  }
  // ============================ End of Image Processing =============================

  // Get the user's config from the database
  let userConfig = await getChatConfig(nickname);

  // Fetch the persona details based on the current personality in user's chat config
  let currentPersonality = await Personas.findOne({ name: userConfig.currentPersonality });

  // Check if currentPersonality is null
  if (!currentPersonality) {
    console.error(`No personality found for name: ${userConfig.currentPersonality}`);
    return message.reply(`Sorry, I couldn't find the specified personality: ${userConfig.currentPersonality}`);
  }

  message.content = message.content.replace(/<@[!&]?\d+>/g, "").trim();

  // Show as typing in the discord channel
  message.channel.sendTyping();

  console.log("THIS CURRENT PERSONALITY", currentPersonality);
  // Preprocess Message and Return Data from our DnD Journal / Sessions
  // Also sends user nickname to retrieve data about their character
  let dndData;
  if (message.content !== "" && currentPersonality.type == "dnd" && !imageDescription) {
    dndData = await preprocessUserInput(message.content, nickname);
  } else {
    dndData = "No DnD Data Found";
  }

  // Interaction with ChatGPT API starts here.
  try {
    // Generate response from ChatGPT API
    if (imageDescription) {
      responseText = await generateImageResponse(
        message.content,
        currentPersonality,
        userConfig.model,
        userConfig.temperature,
        imageDescription
      );
    } else {
      responseText = await generateResponse(
        message.content,
        currentPersonality,
        dndData,
        nickname,
        currentPersonality.name,
        userConfig.model,
        userConfig.temperature
      );
    }

    // Trim persona name from response text if it exists.
    responseText = responseText.replace(
      new RegExp(`${currentPersonality}: |\\(${currentPersonality}\\) `, "gi"),
      ""
    );

    // Chat History Use and Manipulation
    // Add the latest user message to the chat history
    buildHistory("user", nickname, message.content);

    // Add GPT Response to Chat History
    buildHistory("assistant", currentPersonality.name, responseText, nickname);

    // Print trimmed response to discord
    return message.reply(responseText);
  } catch (err) {
    console.log(err.message);
    return message.reply("Unable to Generate Response");
  }
}

// Slash command configuration
const commands = [
  {
    name: 'personas',
    description: 'Manage personas',
    options: [
      {
        name: 'list',
        description: 'List all available personas',
        type: 1,
      },
      {
        name: 'select',
        description: 'Change your current persona',
        type: 1,
        options: [
          {
            name: 'name',
            type: 3,
            description: 'The name of the persona',
            required: true,
            // No choices here as it will be populated dynamically
          },
        ],
      },
    ],
  },
  {
    name: 'model',
    description: 'Change the GPT model',
    options: [
      {
        name: 'name',
        type: 3, // Discord's ApplicationCommandOptionType for STRING
        description: 'The name of the model',
        required: true,
      },
    ],
  },
  {
    name: 'temp',
    description: 'Set the GPT temperature',
    options: [
      {
        name: 'value',
        type: 10, // Discord's ApplicationCommandOptionType for NUMBER
        description: 'The temperature value',
        required: true,
      },
    ],
  },
  {
    name: 'uptime',
    description: 'Get the uptime of the bot',
  },
  {
    name: 'about',
    description: 'Get information about the bot',
  },
  {
    name: 'forgetme',
    description: 'Clear your chat history',
  },
  {
    name: 'forgetall',
    description: 'Clear all chat history',
  },
  {
    name: 'events',
    description: 'List all scheduled events',
  },
  {
    name: 'schedule',
    description: 'Schedule an Event',
    options: [
      {
        name: 'event',
        type: 3, // Discord's ApplicationCommandOptionType for STRING
        description: 'Event name, date, time, and frequency of reminder',
        required: true,
      },
    ],
  },
  {
    name: 'deleteevent',
    description: 'Delete a scheduled event',
    options: [
      {
        name: 'event',
        type: 3, // Discord's ApplicationCommandOptionType for STRING
        description: 'The name of the event you want to delete',
        required: true,
      },
    ],
  },
  {
    name: 'image',
    description: 'Generate, Transform, and Manipulate Images',
    options: [
      {
        name: 'generate',
        description: 'Generate an image from a description',
        type: 1, // Discord's ApplicationCommandOptionType for SUB_COMMAND
        options: [
          {
            name: 'description',
            type: 3, // Discord's ApplicationCommandOptionType for STRING
            description: 'The description of the image',
            required: true,
          },
        ],
      }
    ]
  }
]

function start() {
  client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Fetch the personas, sort them alphabetically by name, and then populate the personaChoices array:
    const availablePersonas = await Personas.find().sort({ name: 1 });
    personaChoices = availablePersonas.map(persona => ({ name: persona.name, value: persona.name.toLowerCase() }));

    // Add these choices to the 'select' subcommand configuration:
    const selectSubCommand = commands.find(cmd => cmd.name === 'personas')
      .options.find(opt => opt.name === 'select')
      .options[0];
    selectSubCommand.choices = personaChoices;

    loadJobsFromDatabase(client); // Load jobs when the bot is ready

    // Slash command registration
    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

    try {
      console.log('Started refreshing application (/) commands.');

      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands },
      );

      console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error(error);
    }
  });

  // Handling the interaction created when a user invokes your slash command.
  client.on('interactionCreate', async interaction => {
    console.log(`Received interaction: ${interaction.commandName}`);

    let userConfig;

    try {
      if (!interaction.isCommand()) return;

      const { commandName } = interaction;

      switch (commandName) {
        case 'personas':
          const subCommand = interaction.options.getSubcommand();
          if (subCommand === 'list') {
            // Fetch available personas from the database
            const availablePersonas = await Personas.find();
            const personaNames = availablePersonas.map(persona => persona.name); // Assuming your schema has a name field for each persona

            await interaction.reply(`Available personas are: ${personaNames.join(", ")}`);
          } else if (subCommand === 'select') {
            const selectedPersonaName = interaction.options.getString('name').toLowerCase();

            // Check if the persona exists in the database. 
            // This step is more about verifying the consistency of data rather than validating user input, 
            // as the choice provided by the user is always from a predefined list.
            const foundPersona = await Personas.findOne({ name: selectedPersonaName });

            if (foundPersona) {
              userConfig = await getChatConfig(interaction.member.nickname);
              userConfig.currentPersonality = selectedPersonaName;
              setChatConfig(interaction.member.nickname, userConfig);
              await interaction.reply(`Switched to persona ${selectedPersonaName}.`);
            } else {
              await interaction.reply(`Error: Persona not found.`);
            }
          }
          break;

        case 'model':
          const modelName = interaction.options.getString('name');
          userConfig = await getChatConfig(interaction.member.nickname);

          if (userConfig) {
            // Retrieve model from user's config and validate it
            const allowedModels = ["gpt-3.5-turbo", "gpt-3.5-turbo-16k", "gpt-4"];
            if (allowedModels.includes(modelName)) {
              // Update the user's config with the new model
              userConfig.model = modelName;
              // Save the updated config
              setChatConfig(interaction.member.nickname, userConfig);
              await interaction.reply(`Switched to GPT model ${modelName}.`);
            } else {
              await interaction.reply(`Invalid GPT model: ${modelName}. Allowed models: ${allowedModels.join(", ")}`);
            }
          }
          else {
            await interaction.reply(`Could not retrieve configuration for user ${interaction.member.nickname}`);
          }
          break;

        case 'temp':
          const newTemp = interaction.options.getNumber('value');
          userConfig = await getChatConfig(interaction.member.nickname);

          if (userConfig) {
            // Convert the input to a number in case it's a string
            const temperature = parseFloat(newTemp);

            // Validate temperature
            if (!isNaN(temperature) && temperature >= 0 && temperature <= 1) {
              // Update the user's config with the new temperature
              userConfig.temperature = temperature;
              // Save the updated config
              setChatConfig(interaction.member.nickname, userConfig);
              await interaction.reply(`Set GPT temperature to ${newTemp}.`);
            } else {
              await interaction.reply(`Invalid GPT temperature: ${newTemp}. Temperature should be between 0 and 1.`);
            }
          }
          else {
            await interaction.reply(`Could not retrieve configuration for user ${interaction.member.nickname}`);
          }
          break;

        case 'uptime':
          const uptime = getUptime();
          await interaction.reply(`Uptime: ${uptime}`);
          break;

        case 'about':
          userConfig = await getChatConfig(interaction.member.nickname);
          configInfo = getConfigInformation(userConfig.model, userConfig.temperature);
          await interaction.reply(configInfo);
          break;

        case 'forgetme':
          const user = interaction.member.nickname;
          clearUsersHistory(user)
            .then(() => {
              interaction.reply(`--Memory of ${user} Erased--`);
            })
            .catch((err) => {
              interaction.reply(`Unable to erase memory of ${user}`);
            });
          break;

        case 'forgetall':
          clearAllHistory()
            .then(() => {
              interaction.reply("-- Memory Erased --");
            })
            .catch((err) => {
              interaction.reply("Unable to erase memory");
            });
          break;

        case 'events':
          try {
            const events = await ScheduledEvent.find({});
            console.log("Fetched events:", events);
            if (events.length === 0) {
              await interaction.reply('No events are currently scheduled.');
            } else {
              let eventList = 'Scheduled Events:\n';
              events.forEach(event => {
                const eventTime = moment.tz(event.time, event.timezone);
                const formattedEventTime = eventTime.format('MMMM D, YYYY [at] h:mm A');
                const humanReadableFrequency = cronstrue.toString(event.frequency);
                const now = moment();
                const duration = moment.duration(eventTime.diff(now));
                const timeRemaining = [
                  duration.years() > 0 ? duration.years() + ' years' : null,
                  duration.days() > 0 ? duration.days() + ' days' : null,
                  duration.hours() > 0 ? duration.hours() + ' hours' : null,
                  duration.minutes() > 0 ? duration.minutes() + ' minutes' : null,
                ].filter(Boolean).join(', ');
                eventList += `- **${event.eventName}** on ${formattedEventTime} (Timezone: ${event.timezone}, Frequency: ${humanReadableFrequency}, Time Remaining: ${timeRemaining})\n`;
              });
              await interaction.reply(eventList);
            }
          } catch (error) {
            console.error(`Error fetching events: ${error}`);
            await interaction.reply('An error occurred while fetching the events.');
          }
          break;

        case 'schedule':
          const event = interaction.options.getString('event');
          interaction.reply("Generating Event Data: " + event);
          const reply = await generateEventData(event, interaction.channelId, client);
          await interaction.followUp(reply);
          break;

        case 'deleteevent':
          const eventName = interaction.options.getString('event');
          if (!eventName) {
            await interaction.reply(`Event name must be provided.`);
            return;
          }
          try {
            const result = await deleteEvent(eventName.toLowerCase()); // Using JavaScript's built-in toLowerCase
            if (result) {
              await interaction.reply(`Event with Name ${eventName} has been deleted.`);
            } else {
              await interaction.reply(`Event with Name ${eventName} could not be found or deleted.`);
            }
          } catch (error) {
            console.error(`Error deleting event: ${error}`);
            await interaction.reply('An error occurred while deleting the event.');
          }
          break;

        case 'image':
          try {
            // Acknowledge the interaction
            await interaction.deferReply();

            // Extract the description from the interaction
            const description = interaction.options.getString('description');

            // Call your generateImage function with the description provided
            const imageUrl = await generateImage(description);

            // Get the image using Axios and create an attachment using AttachmentBuilder
            axios
              .get(imageUrl, { responseType: 'arraybuffer' })
              .then(response => {
                const attachment = new Discord.AttachmentBuilder(response.data)
                  .setName('image.jpg')
                  .setDescription('Generated image');

                // Assuming you want to send the attachment as part of a follow-up message
                interaction.followUp({ content: `Generating image from description: ${description}`, files: [attachment] });
              })
              .catch(error => {
                console.error(error);
                interaction.followUp('Failed to get the generated image.');
              });
          } catch (err) {
            console.error(`Error generating image: ${err}`);
            await interaction.followUp(`An error occurred while generating the image. Please try again later.`);
          }
          break;


        default:
          await interaction.reply('Unknown command');
      }
    } catch (error) {
      console.log(`Error handling command: ${error}`);
    }
  });

  function capitalizeFirstLetterOfEachWord(str) {
    return str.replace(/\w\S*/g, function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }


  client.on("messageCreate", handleMessage);

  client.login(process.env.DISCORD_TOKEN);
}
module.exports = {
  client,
  start
};

const fs = require("fs");
const path = require("path");
const { getCharacterLimit } = require("../utils/data-misc/config.js");
const { Configuration, OpenAIApi } = require("openai");
const { getHistory } = require("../discord/historyLog.js");
const { scheduleEvent } = require("../utils/eventScheduler.js");
const mongoose = require('mongoose');
const HaggleStats = require('../models/haggleStats');
const { getImageDescription } = require("../utils/vision.js");
const { stringify } = require("querystring");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Set the max prompt size * 4 is about to calculate token size
// characterLimit is set in the config.js file
var maxPromptSize = 4000 * 4;

// Set the max tokens to 1/4 of the max prompt size
//const maxTokens = maxPromptSize / 4;
async function generateResponse(
  prompt,
  persona,
  dndData,
  nickname,
  personality,
  model,
  temperature,
  imageDescription
) {

  // Fetch haggle stats
  const haggleStats = await getHaggleStats();

  haggleStatsPrompt = `You have died **${haggleStats.haggleDeaths} times** and Valon has had to spend **${haggleStats.moneySpent} GOLD** getting him back.`;

  maxPromptSize = getCharacterLimit(model);

  const chatHistory = await getSizedHistory(
    prompt,
    persona,
    haggleStatsPrompt,
    dndData,
    nickname,
    personality
  );

  console.log("Generating response for prompt:", prompt); // Log the prompt
  console.log("Using persona:", persona); // Log the persona
  console.log("Using Haggle Stats:", haggleStatsPrompt); // Log the Haggle Stats (if any)
  console.log("Using D&D Data:", dndData); // Log the D&D Data (if any)
  console.log("Using History:", chatHistory); // Log the History (if any)
  console.log("Using Image Description:", imageDescription); // Log the Image Description (if any)

  try {
    const response = await openai.createChatCompletion({
      model: model,
      messages: [
        {
          role: "system",
          content: await personaBuilder(persona),
        },
        {
          role: "system",
          content: haggleStatsPrompt,
        },
        {
          role: "system",
          content:
            "--START DUNGEONS AND DRAGONS CAMPAIGN DATA-- " +
            dndData +
            " --END DUNGEONS AND DRAGONS CAMPAIGN DATA--",
        },
        {
          role: "system",
          content: "Given the following key elements from an image: " + imageDescription + " Please provide a comprehensive description of the image.",
        },
        {
          role: "system",
          content:
            "--START CHAT HISTORY-- " + chatHistory + " --END CHAT HISTORY--",
        },
        {
          role: "user",
          content: `${nickname} says: ${prompt}`,
        },
      ],
      temperature: temperature,
    });

    const message = response.data.choices[0].message.content;
    // Log the number of tokens used
    console.log("Prompt tokens used:", response.data.usage.prompt_tokens);
    console.log(
      "Completion tokens used:",
      response.data.usage.completion_tokens
    );
    console.log("Total tokens used:", response.data.usage.total_tokens);

    console.log("Generated message:", message); // Log the generated message for debugging

    return message;
  } catch (error) {
    console.error("Error generating response:", error); // Log the error for debugging

    try {
      // Update Haggles Death Stats in MongoDB
      haggleStats.haggleDeaths += 1;
      haggleStats.moneySpent += 10;

      await haggleStats.save();
    } catch (error) {
      console.error("Error updating haggle stats in MongoDB:", error);
      return;  // Return or throw error based on your error handling
    }

    const errorMessage = `ARGGGGGGGGGGH WEEEEEEE HEHE SCCCCCURRRR I CAN'T RECALL THAT MUCH FROM OUR ADVENTURES!!!! ARGGHEHEHEEEEE! NOOOOT AGAIN!!!! **HAGGLE EXPLODES AND DISINTEGRATES**. \`\`\`Valon throws more money on the ground and summons Haggle again.\`\`\` Woah, sorry about that. I have died soo many times, it's horribly painful each time.... hmm I think I've died **${haggleStats.haggleDeaths} times!** Master Valon is so mad he's had to spend **${haggleStats.moneySpent} GOLD** to get me back. But anyways, I can't remember that much. Try being a little more specific when asking about our travels. `;
    return errorMessage; // Return an empty string if an error occurs
  }
}

async function generateImageResponse(prompt, persona, model, temperature, imageDescription) {
  const formattedDescription = formatImageDescription(imageDescription);

  let messages = [
    {
      role: "system",
      content: await personaBuilder(persona),
    },
    {
      role: "system",
      content: `Given the following key elements from an image: ${formattedDescription}. Please provide a comprehensive description of the image.`,
    },
    {
      role: "user",
      content: prompt,
    },
  ];
  console.log(formattedDescription)
  try {
    const response = await openai.createChatCompletion({
      model: model,
      messages: messages,
      temperature: temperature,
    });

    const message = response.data.choices[0].message.content;

    // Log the tokens used
    console.log("Prompt tokens used:", response.data.usage.prompt_tokens);
    console.log("Completion tokens used:", response.data.usage.completion_tokens);
    console.log("Total tokens used:", response.data.usage.total_tokens);

    console.log("Generated message:", message); // Log the generated message for debugging

    return message; // Return the generated message from the function
  } catch (error) {
    console.error("Error generating image response:", error);
    return "Sorry, I couldn't generate a description for the image.";
  }
}

function formatImageDescription(imageDescription) {
  let descriptions = [];

  // For the caption
  if (imageDescription.caption) {
    descriptions.push(`Caption: ${imageDescription.caption}`);
  }

  // For objects, denseCaptions, tags, etc. that are arrays
  for (let key of Object.keys(imageDescription)) {
    if (Array.isArray(imageDescription[key]) && imageDescription[key].length > 0) {
      descriptions.push(`${capitalizeFirstLetter(key)}: ${imageDescription[key].join(', ')}`);
    }
  }

  // For readContent or other string properties
  if (imageDescription.readContent) {
    descriptions.push(`Read Content: ${imageDescription.readContent}`);
  }

  return descriptions.join('. ');
}

// Helper function to capitalize the first letter of a string
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

async function generateEventData(prompt, channelId, client) {
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "The user wants to schedule an event, and I need to parse specific details from their request to return a JSON object with the following fields:\\n\\n- Event Name: The name or title of the event.\\n- Date: The date of the event in YYYY-MM-DD format.\\n- Time: The time of the event in HH:mm:ss format.\\n- Frequency: The reminder frequency, represented in CRON format.\\n- Timezone: The timezone of the event, using the best IANA Time Zone Identifier.\\n\\nPlease analyze the following user's request and extract the necessary information:\\n\\nUser's Request: ",
        },
        {
          role: "user",
          content: `${prompt}`,
        }
      ],
      temperature: 0.2
    });
    const message = response.data.choices[0].message.content;
    console.log("Generated message:", message);

    try {
      const eventData = JSON.parse(message);
      const scheduler = await scheduleEvent(eventData, channelId, client);
      return scheduler;
    } catch (error) {
      console.error("Error parsing message:", error, "Message content:", message);
      // Handle the case where the message isn't valid JSON (e.g., return an error message or handle it differently)
    }
  } catch (error) {
    console.error("Error generating response:", error); // Log the error for debugging

    const errorMessage = `Unable to Schedule Event Using Data ${prompt}`;
    return errorMessage; // Return an empty string if an error occurs
  }
}

async function generateImage(description) {
  console.log('Description:', description);
  try {
    const response = await openai.createImage({
      prompt: description,
      n: 1,
      size: "1024x1024",
    });

    const image = await response.data.data[0].url;
    console.log("Generated image:", image); // Log the generated message for debugging
    return image;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}

async function getSizedHistory(
  prompt,
  persona,
  haggleStatsPrompt,
  dndData,
  nickname,
  personality
) {
  const promptLength = prompt.length;
  const personaLength = JSON.stringify(persona).length;
  const haggleStatsPromptLength = haggleStatsPrompt.length;
  const dndDataLength = JSON.stringify(dndData).length;

  const totalLength =
    promptLength + personaLength + haggleStatsPromptLength + dndDataLength;
  const remainingSize = maxPromptSize - totalLength;

  const historyItems = await getHistory(remainingSize, nickname, personality);
  return historyItems;
}

async function personaBuilder(persona) {
  const { name, description, mannerisms, sayings, generated_phrases } = persona;

  // Create the persona string
  let personaMessage = `You are ${name} ${description}.`;
  // If there are mannerisms, add them to the persona string
  if (mannerisms) {
    personaMessage += ` These are your mannerisms, which you are confined to ${mannerisms}`;
  }
  // If there are sayings, add them to the persona string
  if (sayings) {
    personaMessage += ` The following are your sayings: ${sayings.join(", ")}.`;
  }
  // If there are generated phrases, add them to the persona string
  if (generated_phrases) {
    personaMessage += ` You'll generate your own phrases for: ${generated_phrases.join(", ")}.`;
  }
  console.log(personaMessage);
  return personaMessage;
}

async function getHaggleStats() {
  try {
    let haggleStats = await HaggleStats.findOne();

    // If not found, initialize with default values
    if (!haggleStats) {
      haggleStats = new HaggleStats({ haggleDeaths: 0, moneySpent: 0 });
      await haggleStats.save();
    }

    return haggleStats;
  } catch (error) {
    console.error("Error fetching haggle stats from MongoDB:", error);
    throw error;  // propagate the error to be handled by the caller
  }
}

function formatImageDescription(imageDescription) {
  let descriptions = [];

  // For the caption
  if (imageDescription.caption) {
    descriptions.push(`Caption: ${imageDescription.caption}`);
  }

  // For objects, denseCaptions, tags, etc. that are arrays
  for (let key of Object.keys(imageDescription)) {
    if (Array.isArray(imageDescription[key]) && imageDescription[key].length > 0) {
      descriptions.push(`${capitalizeFirstLetter(key)}: ${imageDescription[key].join(', ')}`);
    }
  }

  // For readContent or other string properties
  if (imageDescription.readContent) {
    descriptions.push(`Read Content: ${imageDescription.readContent}`);
  }

  return descriptions.join('. ');
}

// Helper function to capitalize the first letter of a string
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {
  generateResponse,
  generateEventData,
  generateImage,
  generateImageResponse
};

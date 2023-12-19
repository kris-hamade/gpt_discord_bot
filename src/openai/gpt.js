const { getCharacterLimit } = require("../utils/data-misc/config.js");
const OpenAI = require("openai");
const { getHistory } = require("../discord/historyLog.js");
const { scheduleEvent } = require("../utils/eventScheduler.js");
const HaggleStats = require('../models/haggleStats');
const { getImageDescription } = require("../utils/vision.js");
const leonardo = require('api')('@leonardoai/v1.0#28807z41owlgnis8jg');
const axios = require('axios');


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Set the max prompt size * 4 is about to calculate token size
// characterLimit is set in the config.js file
var maxPromptSize = 4000 * 4;

leonardo_ai_auth = process.env.LEONARDO_AI_KEY

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
  imageDescription,
  channelId
) {

  // Fetch haggle stats
  const haggleStats = await getHaggleStats();

  haggleStatsPrompt = `You have died **${haggleStats.haggleDeaths} times** and Valon has had to spend **${haggleStats.moneySpent} GOLD** getting him back.`;

  maxPromptSize = getCharacterLimit(model);

  const chatHistory = await getHistory(nickname, personality, channelId);

  console.log("Generating response for prompt:", prompt); // Log the prompt
  console.log("Using persona:", persona); // Log the persona
  console.log("Using Haggle Stats:", haggleStatsPrompt); // Log the Haggle Stats (if any)
  console.log("Using D&D Data:", dndData); // Log the D&D Data (if any)
  console.log("Using History:", chatHistory); // Log the History (if any)
  console.log("Using Image Description:", imageDescription); // Log the Image Description (if any)

  try {
    const response = await openai.chat.completions.create({
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

    const message = response.choices[0].message.content;
    // Log the number of tokens used
    console.log("Prompt tokens used:", response.usage.prompt_tokens);
    console.log(
      "Completion tokens used:",
      response.usage.completion_tokens
    );
    console.log("Total tokens used:", response.usage.total_tokens);

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

async function generateVulnerabilityReport(vulnerabilities) {
  let messages = [
    {
      role: "system",
      content: "You are a systems security engineer specializing in vulnerability assessment. You will be provided data from a NIST API query containing recent CVE entries. Please review the data and provide a brief report highlighting the vulnerabilities you consider to be the most critical based on factors like exploitability, impact, and the types of systems affected. Return the report in a format that will look good in Discord Markdown messages. Wrap each listed vulnerablity with three backticks to make them look like code blocks.",
    },
    {
      role: "user",
      content: vulnerabilities,
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: messages,
      temperature: 0.6,
    });

    const message = response.choices[0].message.content;

    // Log the tokens used
    console.log("Prompt tokens used:", response.usage.prompt_tokens);
    console.log("Completion tokens used:", response.usage.completion_tokens);
    console.log("Total tokens used:", response.usage.total_tokens);

    console.log("Generated message:", message); // Log the generated message for debugging
    return message; // Return the generated message from the function
  } catch (error) {
    console.error("Error generating full vulnerability report response:", error);
    return "Sorry, I couldn't generate a full vulnerability report based on the CVEs.";
  }
}

async function generateWebhookReport(message) {
  let messages = [
    {
      role: "system",
      content: "You are receiving a webhook. Please describe what the source is and your assessment of what the data is that is being received. Use your best judgement to draw conclusions and build a report.",
    },
    {
      role: "user",
      content: message,
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: messages,
      temperature: 0.6,
    });

    const message = response.choices[0].message.content;

    // Log the tokens used
    console.log("Prompt tokens used:", response.usage.prompt_tokens);
    console.log("Completion tokens used:", response.usage.completion_tokens);
    console.log("Total tokens used:", response.usage.total_tokens);

    console.log("Generated message:", message); // Log the generated message for debugging
    return message; // Return the generated message from the function
  } catch (error) {
    console.error("Error generating webhook report response:", error);
    return "Sorry, I couldn't generate a webhook report based on the data received";
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
    const response = await openai.chat.completions.create({
      model: model,
      messages: messages,
      temperature: temperature,
    });

    const message = response.choices[0].message.content;

    // Log the tokens used
    console.log("Prompt tokens used:", response.usage.prompt_tokens);
    console.log("Completion tokens used:", response.usage.completion_tokens);
    console.log("Total tokens used:", response.usage.total_tokens);

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
    console.log(`Generating event data with prompt: ${prompt}`);

    const exampleJson = {
      "Event Name": "Sample Event",
      "Date": "YYYY-MM-DD",
      "Time": "HH:mm:ss",
      "Frequency": "CRON format",
      "Timezone": "IANA Time Zone"
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content:
            "The user wants to schedule an event based on the following template JSON. Please fill in the details based on the user's request:\n\n" +
            JSON.stringify(exampleJson, null, 2) + "\n\nUser's Request: "
        },
        {
          role: "user",
          content: `${prompt}`
        }
      ],
      temperature: 0.2
    });

    const message = response.choices[0].message.content;
    console.log("Generated message from GPT:", message);

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
    const response = await axios.post('https://api.openai.com/v1/images/generations', {
      "model": "dall-e-3",
      "prompt": description,
      "n": 1,
      "size": "1024x1024"
    }, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    console.log(response.data);

    // Extract the URL from the response data if it exists
    let imageUrls = response.data.data ? response.data.data.map(item => item.url) : [];
    console.log('Generated Image URLs:', imageUrls);

    // Return the image URLs along with an indication that the operation was successful (eta: 0)
    return { imageUrls, eta: 0 };
  } catch (error) {
    console.error("Error generating image:", error);
    // Return an empty array for imageUrls and an error indicator for eta
    return { imageUrls: [], eta: -1 };
  }
}

async function generateImageStableDiffusion(description) {
  console.log('Description:', description);

  try {
    const response = await axios.post('https://stablediffusionapi.com/api/v4/dreambooth', {
      "key": `${process.env.STABLE_DIFFUSION_KEY}`,
      "model_id": "realistic-vision-51",
      "prompt": description,
      "negative_prompt": "extra fingers, mutated hands, poorly drawn hands, poorly drawn face, deformed, ugly, blurry, bad anatomy, bad proportions, extra limbs, cloned face, skinny, glitchy, double torso, extra arms, extra hands, mangled fingers, missing lips, ugly face, distorted face, extra legs, robot eyes, bad teeth",
      "width": "512",
      "height": "512",
      "samples": "4",
      "num_inference_steps": "30",
      "safety_checker": "no",
      "enhance_prompt": "no",
      "seed": null,
      "guidance_scale": 7.5,
      "multi_lingual": "no",
      "panorama": "no",
      "self_attention": "no",
      "upscale": "no",
      "embeddings_model": null,
      "lora_model": null,
      "tomesd": "yes",
      "use_karras_sigmas": "yes",
      "vae": null,
      "lora_strength": null,
      "scheduler": "UniPCMultistepScheduler",
      "webhook": null,
      "track_id": null
    });


    console.log(response.data);

    let imageUrls = [];

    if (response.data.status === 'processing') {
      imageUrls = response.data.future_links;
      // Wait for all the images to be available
      await checkAllImagesAvailability(imageUrls);
      return { imageUrls, eta: response.data.eta };
    } else {
      return { imageUrls: response.data.output, eta: 0 };
    }
  } catch (error) {
    console.error("Error generating image:", error);
    return { imageUrls: [], eta: -1 };
  }
}

const MAX_RETRIES = 60;  // Maximum number of times to check for image availability

async function checkAllImagesAvailability(urls) {
  // Using Promise.all to wait for all images to become available
  await Promise.all(urls.map(url => checkImageAvailability(url)));
}

async function checkImageAvailability(url, attempt = 1) {
  try {
    const response = await axios.head(url); // Using HEAD request to check if resource exists without downloading it

    // If successful response, resolve the promise indicating image is available
    if (response.status === 200) {
      return;  // Resolve the promise
    }
  } catch (error) {
    // If a 404 error, it means image is not available yet, so retry
    if (error.response && error.response.status === 404 && attempt <= MAX_RETRIES) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          checkImageAvailability(url, attempt + 1).then(resolve).catch(reject);
        }, 1000);  // Check every second
      });
    }
  }

  // If reached here, either max retries exceeded or some other error occurred
  throw new Error('Failed to validate image availability for URL ' + url);
}

async function generateLeonardoImage(description) {
  console.log('Description:', description);

  try {
    // Authenticate with the SDK
    leonardo.auth(leonardo_ai_auth);

    // Create a generation
    const generationResponse = await leonardo.createGeneration({
      prompt: `${description}`,
      modelId: '291be633-cb24-434f-898f-e662799936ad',
      sd_version: 'v2',
      width: 512,
      height: 512,
      num_images: 4,
      promptMagic: true,
      negative_prompt: 'extra fingers, mutated hands, poorly drawn hands, poorly drawn face, deformed, ugly, blurry, bad anatomy, bad proportions, extra limbs, cloned face, skinny, glitchy, double torso, extra arms, extra hands, mangled fingers, missing lips, ugly face, distorted face, extra legs, easynegative (epicnegative:0.9) ng_deepnegative_v1_75t badhandv4, logos, brands, icons, text'
    });
    //console.log(generationResponse)
    const generationId = generationResponse.data.sdGenerationJob.generationId;

    // Re-authenticate if needed (remove this line if not necessary)
    leonardo.auth(leonardo_ai_auth);

    // Get the generation by ID
    const result = await getGenerationWhenComplete(generationId);
    console.log(result)
    const imageUrls = result.generations_by_pk.generated_images;
    console.log("Generated images:", imageUrls); // Log the generated URLs for debugging

    return imageUrls;
  } catch (error) {
    console.error("Error generating image:", error);
    return [];
  }
}

async function getGenerationWhenComplete(generationId, delay = 2000, maxAttempts = 20) {
  let attempts = 0;

  async function tryGetGeneration() {
    attempts++;

    if (attempts > maxAttempts) {
      throw new Error("Maximum attempts reached.");
    }

    // Assuming you're authenticating here
    leonardo.auth(leonardo_ai_auth);

    const response = await leonardo.getGenerationById({ id: generationId });
    if (response.data.generations_by_pk.status !== "PENDING") {
      return response.data;
    }

    // Wait for the delay duration and try again
    await new Promise(resolve => setTimeout(resolve, delay));
    return tryGetGeneration();
  }

  return tryGetGeneration();
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
  generateImageResponse,
  generateLeonardoImage,
  generateVulnerabilityReport,
  generateWebhookReport
};

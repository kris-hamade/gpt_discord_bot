// Configurations for chat_gpt_bot
// Instantiate moment.js for timestamping
const moment = require('moment');
// Sets the version of the bot
const version = "1.4.1.0";
// Sets the GPT model
let gptModel = "gpt-4";
// Sets the GPT temperature
// Causing an issue when used in gpt.js
let gptTemperature = "1";
// Sets Character limit in gpt.js and preprocessor.js
let characterLimit = 8000 * 4;

// Start tracking bot uptime
const startTime = moment();

function setGptModel(newModel) {
    const allowedModels = ["gpt-3","gpt-3.5-turbo", "gpt-4"];
    if (allowedModels.includes(newModel)) {
        // Ternary operator to set gptModel to gpt-3.5-turbo if gpt-3 is selected
        gptModel = newModel === "gpt-3" ? "gpt-3.5-turbo" : newModel;        

        characterLimit = newModel === "gpt-4" ? 8000 * 4 : 4000 * 4;
        return {
            success: true,
            message: `Switched to GPT model ${newModel}.`
        };
    } else {
        const errorMessage = `Invalid GPT model: ${newModel}. Allowed models: ${allowedModels.join(", ")}`;
        console.error(errorMessage);
        return {
            success: false,
            message: errorMessage
        };
    }
}

function setGptTemperature(newTemperature) {
    if (newTemperature >= 0 && newTemperature <= 2) {
        gptTemperature = newTemperature;
    } else {
        console.error("Invalid GPT temperature. Temperature should be between 0 and 2.");
    }
}

function getCharacterLimit() {
    return characterLimit;
}

function getGptModel() {
    return gptModel;
}

function getUptime() {
    const now = moment();
    const duration = moment.duration(now.diff(startTime));
    return duration.humanize();
}

function getConfigInformation() {
    return `Version: ${version}
  GPT Model: ${gptModel}
  GPT Temperature: ${gptTemperature}
  Character Limit: ${characterLimit}
  Start Time: ${startTime.format('YYYY-MM-DD HH:mm:ss')}
  Uptime: ${getUptime()}`;
}

module.exports = {
    version,
    gptTemperature,
    getCharacterLimit,
    getConfigInformation,
    getGptModel,
    getUptime,
    setGptModel,
    setGptTemperature,
};
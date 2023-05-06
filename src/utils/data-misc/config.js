// Configurations for chat_gpt_bot
// Sets the version of the bot
const version = "1.4.0.2";
// Sets the GPT model
let gptModel = "gpt-4";
// Sets the GPT temperature
// Causing an issue when used in gpt.js
let gptTemperature = "1";
// Sets Character limit in gpt.js and preprocessor.js
let characterLimit = 8000 * 4;

function setGptModel(newModel) {
    const allowedModels = ["gpt-3.5-turbo", "gpt-4"];

    if (allowedModels.includes(newModel)) {
        gptModel = newModel;
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

function getConfigInformation() {
    return `Version: ${version}
  GPT Model: ${gptModel}
  GPT Temperature: ${gptTemperature}
  Character Limit: ${characterLimit}`;
}

module.exports = {
    version,
    gptTemperature,
    getCharacterLimit,
    getConfigInformation,
    setGptModel,
    setGptTemperature,
    getGptModel
};
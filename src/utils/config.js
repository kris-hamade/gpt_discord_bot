// Configurations for chat_gpt_bot
// Instantiate moment.js for timestamping
const moment = require('moment');
// Sets the version of the bot
const version = "1.7.1.1";
// Sets Character limit in gpt.js and preprocessor.js
let characterLimit = 96000 * 4;

// Start tracking bot uptime
const startTime = moment();

function getCharacterLimit(model) {
    characterLimit = model === "gpt-4-turbo-preview" ? 96000 * 4 : 96000 * 4;
    return characterLimit;
}

function getUptime() {
    const now = moment();
    const duration = moment.duration(now.diff(startTime));
    return duration.humanize();
}

function getConfigInformation(model, temperature) {
    configCharacterLimit = getCharacterLimit(model)
    let modelInformation = model !== "" ? `Model: ${model}` : "";
    let temperatureInformation = temperature !== "" ? `Temperature: ${temperature}` : "";

    return `Version: ${version}
  Character Limit: ${configCharacterLimit}
  ${modelInformation}
  ${temperatureInformation}
  Start Time: ${startTime.format('YYYY-MM-DD HH:mm:ss')}
  Uptime: ${getUptime()}`;
}


module.exports = {
    version,
    getCharacterLimit,
    getConfigInformation,
    getUptime,
};
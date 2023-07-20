const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const natural = require("natural");
const { getCharacterLimit } = require("./data-misc/config.js");
const { getChatConfig } = require("../discord/chatConfig.js");
const stemmer = natural.PorterStemmer;
const { BrillPOSTagger } = natural;
const lexicon = new natural.Lexicon("EN", "N", "NNP");
const rules = new natural.RuleSet("EN");
const tagger = new BrillPOSTagger(lexicon, rules);

const namesFolder = path.join(__dirname, "data-json");

function loadNamesData() {
  const namesFileNames = fs.readdirSync(namesFolder);
  const namesFilePattern = /^\d{8}-JournalExport\.json$/;
  const namesFileName = namesFileNames.find((name) =>
    namesFilePattern.test(name)
  );
  if (!namesFileName) {
    throw new Error("No names file found");
  }

  const namesFile = path.join(namesFolder, namesFileName);
  const namesData = JSON.parse(fs.readFileSync(namesFile, "utf-8"));
  
  return namesData
    .filter(({ Name }) => Name) // Filter out entries where Name is not truthy (e.g., undefined, null, or empty string)
    .flatMap(({ Name }) => Name.split(" "));
}
function isCustomToken(token, customNouns) {
  return customNouns.some(
    (customNoun) => customNoun.toLowerCase() === token.toLowerCase()
  );
}

async function preprocessUserInput(input, nickname) {
  const customNouns = loadNamesData();
  const dataFolder = path.join(__dirname, "data-json");
  const fileNames = fs.readdirSync(dataFolder);
  const data = {};

  const userConfig = await getChatConfig(nickname);

  const relevantTags =
    userConfig.model === "gpt-3" || userConfig.model === "gpt-3.5-turbo"
      ? ["N", "NN", "NNS", "NNP", "NNPS"]
      : ["N", "NN", "NNS", "NNP", "NNPS", "JJ", "JJR", "JJS"];

  fileNames.forEach((file) => {
    const filePath = path.join(dataFolder, file);
    const content = fs.readFileSync(filePath, "utf-8");
    data[file] = JSON.parse(content);
  });

  const tokenizer = new natural.WordTokenizer();

  const stopWordsFile = path.join(
    ".",
    "src",
    "utils",
    "data-misc",
    "stop-words.txt"
  );
  const stopWords = fs.readFileSync(stopWordsFile, "utf8").trim().split(/\s+/);

  function preprocess(userInput, nickname) {
    let tokens = tokenizer.tokenize(userInput);

    // Append the nickname to the list of tokens
    if (nickname) {
      tokens.push(nickname);
    }

    tokens = tokens.map((token) => token.toLowerCase());
    tokens = tokens.filter((token) => !stopWords.includes(token));

    const taggedTokens = tagger.tag(tokens).taggedWords;

    console.log("Tagged tokens: ", taggedTokens);

    const relevantTokens = taggedTokens
      .filter(
        (token) =>
          relevantTags.includes(token.tag) ||
          isCustomToken(token.token, customNouns)
      )
      .map((token) => token.token);
    console.log("Noun tokens: ", relevantTokens);
    return relevantTokens;
  }

  function search_data(tokens, data) {
    let relevantDocs = [];

    // Set the max character count for the response
    // characterLimit is set in the config.js file
    const maxChars = getCharacterLimit(userConfig.model);

    // Set the minimum number of tokens that must match based on GPT model
    const minMatchCount =
      userConfig.model === "gpt-3" || userConfig.model === "gpt-3.5-turbo" ? 2 : 1;

    // Stem the tokens
    let stemmedTokens = tokens.map((token) =>
      stemmer.stem(token.toLowerCase())
    );
    console.log("Stemmed tokens: ", stemmedTokens);

    _.forEach(data, (fileContent) => {
      if (Array.isArray(fileContent)) {
        fileContent.forEach((doc) => {
          // Stem the words in the Name and Bio fields
          let stemmedName =
            doc && doc.Name && typeof doc.Name === "string"
              ? doc.Name.split(" ")
                  .map((word) => stemmer.stem(word.toLowerCase()))
                  .join(" ")
              : "";
          let stemmedBio =
            doc && doc.Bio && typeof doc.Bio === "string"
              ? doc.Bio.split(" ")
                  .map((word) => stemmer.stem(word.toLowerCase()))
                  .join(" ")
              : "";

          let matchCount = 0;
          stemmedTokens.forEach((stemmedToken) => {
            if (
              stemmedName.includes(stemmedToken) ||
              stemmedBio.includes(stemmedToken)
            ) {
              matchCount++;
            }
          });

          // Only add the doc to relevantDocs if it matches a certain number of tokens
          if (matchCount >= minMatchCount) {
            relevantDocs.push({
              doc,
              count: matchCount,
            });
          }
        });
      } else {
        console.warn(`fileContent is not an array: ${fileContent}`);
      }
    });

    relevantDocs.sort((a, b) => b.count - a.count);

    let totalCharacters = 0;
    let filteredRelevantDocs = [];

    for (let doc of relevantDocs) {
      let docLength = JSON.stringify(doc).length;
      if (totalCharacters + docLength <= maxChars) {
        totalCharacters += docLength;
        filteredRelevantDocs.push(doc);
      } else {
        break;
      }
    }

    return JSON.stringify(filteredRelevantDocs);
  }

  const userInput = input;
  const tokens = preprocess(userInput, nickname);
  const relevantDocs = search_data(tokens, data);

  console.log(relevantDocs);

  return relevantDocs;
}

module.exports = {
  preprocessUserInput,
};

const _ = require('lodash');
const fs = require('fs');
const path = require('path');

// This Section is for the POS Tagger
const natural = require('natural');
const {
  BrillPOSTagger
} = natural;
const lexicon = new natural.Lexicon('EN', 'N', 'NNP');
const rules = new natural.RuleSet('EN');
const tagger = new BrillPOSTagger(lexicon, rules);

// Define an array of noun tags
const nounTags = ['N', 'NN', 'NNS', 'NNP', 'NNPS'];

async function preprocessUserInput(input) {
  // Read files from the 'data' folder <JSON Files
  const dataFolder = path.join(__dirname, 'data-json');
  const fileNames = fs.readdirSync(dataFolder);
  const data = {};

  fileNames.forEach(file => {
    const filePath = path.join(dataFolder, file);
    // read the file and parse the JSON
    const content = fs.readFileSync(filePath, 'utf-8');
    data[file] = JSON.parse(content);
  });

  // Tokenizer
  const tokenizer = new natural.WordTokenizer();

  // Stop words section
  // Read in the file containing stop words
  // The file is expected to have one stop word per line
  const stopWordsFile = path.join('.', 'src', 'utils', 'data-misc', 'stop-words.txt');
  const stopWords = fs.readFileSync(stopWordsFile, 'utf8').trim().split(/\s+/);

  function preprocess(userInput) {
    // Tokenize the user input
    let tokens = tokenizer.tokenize(userInput);

    // Convert to lower case
    tokens = tokens.map(token => token.toLowerCase());

    // POS tagging
    const taggedTokens = tagger.tag(tokens).taggedWords;
    console.log(taggedTokens); // Add this line to debug

    // Filter out non-nouns
    const nounTokens = taggedTokens
      .filter(token => nounTags.includes(token.tag))
      .map(token => token.token);


    // Remove stop words
    const filteredTokens = nounTokens.filter(token => !stopWords.includes(token));

    return filteredTokens;
  }

  // JSON File Parser
  function search_data(tokens, data) {
    let relevantDocs = [];

    // For Setting Max Number of Characters
    let maxChars = 30000;

    // Iterate over each object in the array
    _.forEach(data, (fileContent) => {
      // Iterate over each object in the file's content
      fileContent.forEach(doc => {
        // Iterate over each token
        tokens.forEach(token => {
          // Check if the token appears in either the Name or Bio fields
          if (doc.Name.toLowerCase().includes(token) || doc.Bio.toLowerCase().includes(token)) {
            // Count the number of times the token appears in the document
            const count = (doc.Bio.toLowerCase().match(new RegExp(token, 'g')) || []).length;

            // Add the document and count to the relevantDocs array
            relevantDocs.push({
              doc,
              count
            });
          }
        });
      });
    });

    // Sort the relevantDocs array in descending order of count
    relevantDocs.sort((a, b) => b.count - a.count);

    // Filter results based on total characters
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
  const tokens = preprocess(userInput);
  const relevantDocs = search_data(tokens, data);

  //console.log(data)
  console.log(relevantDocs);
  console.log(tokens)

  return relevantDocs;

}

module.exports = {
  preprocessUserInput
};
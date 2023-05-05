const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const natural = require('natural');
const {
  characterLimit
} = require('./data-misc/config.js');
const stemmer = natural.PorterStemmer;
const {
  BrillPOSTagger
} = natural;
const lexicon = new natural.Lexicon('EN', 'N', 'NNP');
const rules = new natural.RuleSet('EN');
const tagger = new BrillPOSTagger(lexicon, rules);

const nounTags = ['N', 'NN', 'NNS', 'NNP', 'NNPS'];

const namesFolder = path.join(__dirname, 'data-json');
const namesFileNames = fs.readdirSync(namesFolder);

const namesFilePattern = /^\d{8}-JournalExport\.json$/;
const namesFileName = namesFileNames.find(name => namesFilePattern.test(name));

if (!namesFileName) {
  throw new Error('No names file found');
}

const namesFile = path.join(namesFolder, namesFileName);
const namesData = JSON.parse(fs.readFileSync(namesFile, 'utf-8'));

const customNouns = namesData.flatMap(({
  Name
}) => Name.split(' '));

function isCustomNoun(token) {
  return customNouns.some(customNoun => customNoun.toLowerCase() === token.toLowerCase());
}

async function preprocessUserInput(input) {
  const dataFolder = path.join(__dirname, 'data-json');
  const fileNames = fs.readdirSync(dataFolder);
  const data = {};

  fileNames.forEach(file => {
    const filePath = path.join(dataFolder, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    data[file] = JSON.parse(content);
  });

  const tokenizer = new natural.WordTokenizer();

  const stopWordsFile = path.join('.', 'src', 'utils', 'data-misc', 'stop-words.txt');
  const stopWords = fs.readFileSync(stopWordsFile, 'utf8').trim().split(/\s+/);

  function preprocess(userInput) {
    let tokens = tokenizer.tokenize(userInput);

    tokens = tokens.map(token => token.toLowerCase());

    tokens = tokens.filter(token => !stopWords.includes(token));

    const taggedTokens = tagger.tag(tokens).taggedWords;

    const nounTokens = taggedTokens
      .filter(token => nounTags.includes(token.tag) || isCustomNoun(token.token))
      .map(token => token.token);

    return nounTokens;
  }

  function search_data(tokens, data) {
    let relevantDocs = [];

    // Set the max character count for the response
    // characterLimit is set in the config.js file
    let maxChars = characterLimit;

    // Stem the tokens
    let stemmedTokens = tokens.map(token => stemmer.stem(token.toLowerCase()));

    _.forEach(data, (fileContent) => {
      fileContent.forEach(doc => {

        // Stem the words in the Name and Bio fields
        let stemmedName = doc.Name.split(' ').map(word => stemmer.stem(word.toLowerCase())).join(' ');
        let stemmedBio = doc.Bio.split(' ').map(word => stemmer.stem(word.toLowerCase())).join(' ');

        stemmedTokens.forEach(stemmedToken => {
          if (stemmedName.includes(stemmedToken) || stemmedBio.includes(stemmedToken)) {
            const count = (stemmedBio.match(new RegExp(stemmedToken, 'g')) || []).length;

            relevantDocs.push({
              doc,
              count
            });
          }
        });
      });
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
  const tokens = preprocess(userInput);
  const relevantDocs = search_data(tokens, data);

  console.log(relevantDocs);
  console.log("these are the tokens" + tokens);

  return relevantDocs;
}

module.exports = {
  preprocessUserInput
};
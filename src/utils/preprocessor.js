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

  // Stop words
  const stopWords = ['i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'];

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
      .filter(token => token.tag === 'N' || token.tag === 'NN' || token.tag === 'NNS' || token.tag === 'NNP' || token.tag === 'NNPS')
      .map(token => token.token);


    // Remove stop words
    const filteredTokens = nounTokens.filter(token => !stopWords.includes(token));

    return filteredTokens;
  }

  //JSON File Parser
  function search_data(tokens, data) {
    let relevantDocs = [];

    // Iterate over each object in the array
    _.forEach(data, (fileContent) => {
      // Iterate over each object in the file's content
      fileContent.forEach(doc => {
        // Iterate over each token
        tokens.forEach(token => {
          // Check if the token appears in either the Name or Bio fields
          if (doc.Name.toLowerCase().includes(token) || doc.Bio.toLowerCase().includes(token)) {
            relevantDocs.push(doc);
          }
        });
      });
    });
    relevantDocs = JSON.stringify(relevantDocs)
    return relevantDocs;
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
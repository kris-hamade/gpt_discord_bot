const fs = require("fs");
const path = require("path");
const moment = require("moment");
const ChatHistory = require('../models/chatHistory');
const { gptWebSocketHandler } = require("../openai/gpt");
const Roll20Data = require("../models/roll20Data");

const {
  getConfigInformation,
  getUptime,
} = require("../utils/config");

const { processWebhook } = require("../utils/webhook");

// Get Bot Status /api/status
exports.status = async (req, res) => {
  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Bot status requested.`
  );
  res.send("Bot is up and running");
};

// Get Bot Config /api/config
exports.config = async (req, res) => {
  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Bot config requested.`
  );
  res.send(getConfigInformation());
};

// Get Bot Uptime /api/uptime
exports.uptime = async (req, res) => {
  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Bot uptime requested.`
  );
  res.send(getUptime());
};

// Clear Chat History /api/clearChatHistory
exports.clearChatHistory = async (req, res) => {
  console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Clear chat history requested.`);

  try {
    // Remove all documents from the ChatHistory collection
    await ChatHistory.deleteMany({});

    console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Chat history cleared successfully.`);
    res.json({
      success: true,
      message: "Chat history cleared successfully.",
    });
  } catch (err) {
    console.error(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] An error occurred while clearing the chat history:`, err);
    res.status(500).json({
      success: false,
      message: "An error occurred while clearing the chat history.",
    });
  }
};

// Clear Uploaded Data /api/clearUploadData
exports.clearUploadData = (req, res) => {
  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Clear upload data requested.`
  );
  const uploadsDirectory = path.join(__dirname, "../utils/data-uploads/");

  fs.readdir(uploadsDirectory, (err, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message:
          "An error occurred while trying to read the uploads directory.",
      });
    }

    console.log(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Files to delete:`,
      files
    );

    for (const file of files) {
      fs.unlink(path.join(uploadsDirectory, file), (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({
            success: false,
            message: "An error occurred while trying to delete files.",
          });
        }
      });
    }

    console.log(
      `[${moment().format(
        "YYYY-MM-DD HH:mm:ss"
      )}] All uploaded files have been successfully deleted.`
    );
    return res.json({
      success: true,
      message: "All uploaded files have been successfully deleted.",
    });
  });
};

// Get Chat History /api/getChatHistory
exports.getChatHistory = async (req, res) => {
  console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Chat history requested.`);

  try {
    // Get all documents from the ChatHistory collection
    const chatHistory = await ChatHistory.find({});

    console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Chat history retrieved.`);
    res.json({
      success: true,
      chatHistory,
    });
  } catch (err) {
    console.error(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] An error occurred while reading the chat history:`, err);
    res.status(500).json({
      success: false,
      message: "An error occurred while reading the chat history.",
    });
  }
};

// Replace Roll20 JSON Data /api/uploadRoll20Data
exports.uploadRoll20Data = async (req, res) => {
  console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Roll20 data upload requested.`);
  const type = req.params.type;

  // Check if a file was uploaded
  if (!req.file) {
    console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] No file uploaded.`);
    return res.status(400).json({
      success: false,
      message: "A file is required.",
    });
  }

  const uploadedFilePath = req.file.path;
  const uploadedFileName = req.file.originalname;

  console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Uploaded file:`, uploadedFileName);

  // Check if the file is a JSON file
  if (!uploadedFileName.endsWith(".json")) {
    console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Invalid file type.`);
    return res.status(400).json({
      success: false,
      message: "Only JSON files are allowed.",
    });
  }

  // If the uploaded file is named 'test.json', don't make any modifications
  if (uploadedFileName === "test.json") {
    console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Test upload succeeded.`);
    return res.json({
      success: true,
      message: "Test Upload Succeeded.",
    });
  }

  try {
    // Read uploaded file
    const uploadedDataRaw = await fs.readFile(uploadedFilePath, 'utf-8');
    const uploadedData = JSON.parse(uploadedDataRaw);

    console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Uploaded data retrieved.`);

    let updateCount = 0;
    let newEntryCount = 0;

    // Get all existing documents
    const existingDocs = await Roll20Data.find({});
    const existingDocsMap = new Map();
    existingDocs.forEach(doc => existingDocsMap.set(doc.Name, doc));

    // Compare and update data
    for (const uploadedEntry of uploadedData) {
      const existingDoc = existingDocsMap.get(uploadedEntry.Name);
      if (existingDoc) {
        // If the Name exists in the server data, update the Bio if necessary
        if (uploadedEntry.Bio !== existingDoc.Bio) {
          existingDoc.Bio = uploadedEntry.Bio;
          await existingDoc.save();
          updateCount++;
        }
      } else {
        // If the Name doesn't exist in the server data, add the new entry
        const newDoc = new Roll20Data(uploadedEntry);
        await newDoc.save();
        newEntryCount++;
      }
    }

    console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] ${updateCount} entries updated, ${newEntryCount} new entries added.`);

    res.json({
      success: true,
      message: `${updateCount} entries updated, ${newEntryCount} new entries added.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "An error occurred.",
    });
  }
};

exports.handleGPTInteraction = async ({ userId, content, type }, ws) => {
    try {
        console.log({ userId, content, type }); // Logging for debugging
        await gptWebSocketHandler(userId, content, ws, type);

    } catch (error) {
        console.error("Error in GPT interaction:", error);
        ws.send(JSON.stringify({ error: 'Error processing your request' }));
    }
};

exports.getCharacterSheet = async ({}) => {}

exports.saveCharacterSheet = async ({}) => {}

exports.webhookHandler = (req, res) => {
  // Process the incoming webhook data here
  // console.log(req.body);
  processWebhook(req.body)
  res.status(200).send('Webhook data received!');
};

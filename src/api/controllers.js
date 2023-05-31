const fs = require("fs");
const path = require("path");
const moment = require("moment");
const archiver = require("archiver");
const archiveDirectory = path.join(__dirname, "../utils/data-archive/");
const {
  getConfigInformation,
  getUptime,
} = require("../utils/data-misc/config");

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
exports.clearChatHistory = (req, res) => {
  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Clear chat history requested.`
  );
  const chatHistoryPath = path.join(
    __dirname,
    "../utils/data-misc/chathistory.json"
  );

  // Check if the file exists
  if (!fs.existsSync(chatHistoryPath)) {
    console.log(
      `[${moment().format(
        "YYYY-MM-DD HH:mm:ss"
      )}] Chat history file does not exist.`
    );
    return res.status(404).json({
      success: false,
      message: "Chat history file does not exist.",
    });
  }

  try {
    // Write an empty array to the file, effectively clearing it
    fs.writeFileSync(chatHistoryPath, JSON.stringify([]));

    console.log(
      `[${moment().format(
        "YYYY-MM-DD HH:mm:ss"
      )}] Chat history cleared successfully.`
    );

    res.json({
      success: true,
      message: "Chat history cleared successfully.",
    });
  } catch (err) {
    console.error(
      `[${moment().format(
        "YYYY-MM-DD HH:mm:ss"
      )}] An error occurred while clearing the chat history:`,
      err
    );
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

exports.getChatHistory = (req, res) => {
  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Chat history requested.`
  );
  const chatHistoryFilePath = path.join(
    __dirname,
    "../utils/data-misc/chathistory.json"
  );

  // Check if the file exists
  if (!fs.existsSync(chatHistoryFilePath)) {
    return res.status(404).json({
      success: false,
      message: "Chat history file not found.",
    });
  }

  try {
    // Read the chat history file
    const chatHistory = JSON.parse(
      fs.readFileSync(chatHistoryFilePath, "utf-8")
    );

    console.log(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Chat history retrieved.`
    );
    res.json({
      success: true,
      chatHistory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "An error occurred while reading the chat history.",
    });
  }
};

exports.listFiles = (req, res) => {
  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] List files requested.`
  );
  const type = req.params.type;
  const dataJsonDir = path.join(__dirname, "../utils/data-json");

  let files;
  if (type === "All") {
    files = fs
      .readdirSync(dataJsonDir)
      .filter((fn) => fn.endsWith("Export.json"))
      .sort()
      .reverse();
  } else {
    files = fs
      .readdirSync(dataJsonDir)
      .filter((fn) => fn.endsWith(`${type}Export.json`))
      .sort()
      .reverse();
  }

  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] ${
      files.length
    } ${type} files found:`,
    files
  );

  res.json({
    success: true,
    files,
  });
};

// Replace Roll20 JSON Data /api/uploadRoll20Data
exports.uploadRoll20Data = async (req, res) => {
  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Roll20 data upload requested.`
  );
  const type = req.params.type;
  const dataJsonDir = path.join(__dirname, "../utils/data-json");

  // Check if a file was uploaded
  if (!req.file) {
    console.log(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] No file uploaded.`
    );
    return res.status(400).json({
      success: false,
      message: "A file is required.",
    });
  }

  const uploadedFilePath = req.file.path;
  const uploadedFileName = req.file.originalname;

  console.log(
    `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Uploaded file:`,
    uploadedFileName
  );

  // Check if the file is a JSON file
  if (!uploadedFileName.endsWith(".json")) {
    console.log(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Invalid file type.`
    );
    return res.status(400).json({
      success: false,
      message: "Only JSON files are allowed.",
    });
  }

  // If the uploaded file is named 'test.json', don't make any modifications
  if (uploadedFileName === "test.json") {
    console.log(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Test upload succeeded.`
    );
    return res.json({
      success: true,
      message: "Test Upload Succeeded.",
    });
  }

  // Find the most recent file that matches the type
  const serverFileName = fs
    .readdirSync(dataJsonDir)
    .filter((fn) => fn.endsWith(`${type}Export.json`))
    .sort()
    .reverse()[0];

  let serverData = [];
  if (serverFileName) {
    const originalFilePath = path.join(dataJsonDir, serverFileName);
    // Read server file
    serverData = cleanData(
      JSON.parse(fs.readFileSync(originalFilePath, "utf-8"))
    );

    console.log(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Server file found:`,
      serverFileName
    );

    // Create a path for the archived file
    const archiveFilePath = path.join(archiveDirectory, serverFileName);

    // Move the file to the archive directory
    fs.renameSync(originalFilePath, archiveFilePath);

    console.log(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Server file archived:`,
      archiveFilePath
    );
  }

  try {
    // Read uploaded file
    uploadedData = cleanData(
      JSON.parse(fs.readFileSync(uploadedFilePath, "utf-8"))
    );

    console.log(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] Uploaded data retrieved.`
    );

    // Create a map of the server data by Name
    let serverDataMap = new Map(serverData.map((entry) => [entry.Name, entry]));

    let updateCount = 0;
    let newEntryCount = 0;

    // Compare and update data
    for (const uploadedEntry of uploadedData) {
      const serverEntry = serverDataMap.get(uploadedEntry.Name);
      if (serverEntry) {
        // If the Name exists in the server data, update the Bio if necessary
        if (uploadedEntry.Bio !== serverEntry.Bio) {
          serverEntry.Bio = uploadedEntry.Bio;
          updateCount++;
        }
      } else {
        // If the Name doesn't exist in the server data, add the new entry
        serverData.push(uploadedEntry);
        newEntryCount++;
      }
    }

    console.log(
      `[${moment().format(
        "YYYY-MM-DD HH:mm:ss"
      )}] ${updateCount} entries updated, ${newEntryCount} new entries added.`
    );

    // Create new file with date prepended
    const newFilePath = path.join(
      dataJsonDir,
      `${moment().format("YYYYMMDD")}-${type}Export.json`
    );
    fs.writeFileSync(newFilePath, JSON.stringify(serverData, null, 2));

    console.log(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] New file written:`,
      newFilePath
    );

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

  function cleanData(data) {
    if (typeof data === "string") {
      // Replace U+00A0, U+2019, and U+2013 with a standard space
      return data.replace(/[\u00a0\u2019\u2013]/g, " ");
    } else if (typeof data === "object") {
      for (let key in data) {
        data[key] = cleanData(data[key]);
      }
    }
    return data;
  }
};

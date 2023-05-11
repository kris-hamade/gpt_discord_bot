const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Define the upload and archive directories
const uploadDirectory = './src/utils/data-uploads/';
const archiveDirectory = './src/utils/data-archive/';

// Make sure the archive directory exists
if (!fs.existsSync(archiveDirectory)) {
    fs.mkdirSync(archiveDirectory);
}

function cleanupUploadsDirectory() {
    fs.readdir(uploadDirectory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            const oldPath = path.join(uploadDirectory, file);
            const newPath = path.join(archiveDirectory, file);

            fs.rename(oldPath, newPath, function (err) {
                if (err) throw err;
            });
        }
    });
}

// Run this function once a day
cron.schedule('0 0 * * *', cleanupUploadsDirectory);
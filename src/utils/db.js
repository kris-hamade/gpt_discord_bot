const mongoose = require('mongoose');
require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ssl: true
    });
    console.log('Successfully connected to MongoDB Atlas!');
  } catch (e) {
    console.log('Caught an error while connecting to the database:', e);
    throw e;
  }
};

module.exports = {
  connectDB,
};

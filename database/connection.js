const mongoose = require('mongoose');

async function connectDatabase({
  uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sidequest_dev',
  dbName = process.env.MONGODB_DB_NAME || 'sidequest_dev',
} = {}) {
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 5000,
  });
  return mongoose.connection;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };

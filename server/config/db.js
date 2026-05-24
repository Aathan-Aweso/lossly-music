const mongoose = require('mongoose');
const { MONGODB_URI } = require('./index');

async function connectDb() {
  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  console.log('MongoDB connected:', MONGODB_URI);
}

module.exports = { connectDb };

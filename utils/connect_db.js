const mongoose = require("mongoose");

function connectDb(dbUrl) {
  if (!dbUrl) {
    console.error("FATAL ERROR: MongoDbUrl is not set in environment variables!");
    return;
  }
  console.log("Connecting to MongoDB at:", dbUrl);
  mongoose.connect(dbUrl).then(() => {
    console.log("Connected to MongoDB successfully!");
  }).catch((err) => {
    console.error("Error in MongoDB Connection:", err.message);
  });
}

module.exports = {
  connectDb,
};
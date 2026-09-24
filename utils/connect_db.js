const mongoose = require("mongoose");

// Cache the connection across Vercel serverless invocations.
// On a cold start the promise is created; on warm starts the existing
// connection is reused immediately without reconnecting.
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

async function connectDb(dbUrl) {
  if (!dbUrl) {
    throw new Error("FATAL ERROR: MongoDbUrl is not set in environment variables!");
  }

  // Already connected — reuse
  if (cached.conn) return cached.conn;

  // Connection in progress — wait for it
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(dbUrl)
      .then((m) => {
        console.log("Connected to MongoDB successfully!");
        return m;
      })
      .catch((err) => {
        // Clear the promise so the next request retries
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDb };

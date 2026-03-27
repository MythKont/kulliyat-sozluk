    const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI);
let dbCache = null;

async function connectToDatabase() {
  if (dbCache) return dbCache;
  await client.connect();
  dbCache = client.db("sozluk_db");
  return dbCache;
}

module.exports = { connectToDatabase };
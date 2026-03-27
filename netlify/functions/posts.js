const { connectToDatabase } = require("./utils/db");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET

exports.handler = async (event) => {
  const db = await connectToDatabase();
  const entries = db.collection("entries");
  const method = event.httpMethod;

  // 1. Yazıları Listele (GET)
  if (method === "GET") {
    const allEntries = await entries.find().sort({ createdAt: -1 }).toArray();
    return { statusCode: 200, body: JSON.stringify(allEntries) };
  }

  // 2. Yeni Yazı/Yanıt Ekle (POST) - Sadece Giriş Yapanlar
  if (method === "POST") {
    const token = event.headers.authorization?.split(" ")[1];
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Giriş yapmalısın." }) };

    try {
      const decoded = jwt.verify(token, SECRET);
      const { content, parentId, title } = JSON.parse(event.body);

      const newEntry = {
        userId: decoded.userId,
        username: decoded.username,
        title: title || null, // Eğer ana konuysa başlık olur, yanıt ise null
        content,
        parentId: parentId ? new ObjectId(parentId) : null, // Dallanma noktası
        upvotes: 0,
        downvotes: 0,
        createdAt: new Date()
      };

      const result = await entries.insertOne(newEntry);
      return { statusCode: 201, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 403, body: JSON.stringify({ error: "Geçersiz token." }) };
    }
  }
};
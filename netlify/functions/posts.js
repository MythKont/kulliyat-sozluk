const { connectToDatabase } = require("./utils/db");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET

exports.handler = async (event) => {
  const db = await connectToDatabase();
  const entries = db.collection("entries");
  const method = event.httpMethod;

  // 1. Yazıları Listele (GET)
  // GET isteği gelirse
if (event.httpMethod === "GET") {
    try {
        const since = event.queryStringParameters ? event.queryStringParameters.since : null;
        let query = {};
        
        if (since && since !== "undefined") {
            query = { createdAt: { $gt: new Date(parseInt(since)) } };
        }

        const data = await posts.find(query).sort({ createdAt: -1 }).toArray();
        
        // KRİTİK: Her zaman bir array döndüğünden emin olalım
        return { 
            statusCode: 200, 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Array.isArray(data) ? data : []) 
        };
    } catch (err) {
        console.error("Veritabanı hatası:", err);
        return { statusCode: 500, body: JSON.stringify({ error: "Veriler alınamadı" }) };
    }
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
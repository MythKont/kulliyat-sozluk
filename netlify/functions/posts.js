const { connectToDatabase } = require("./utils/db");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "kulliyat_ozel_anahtar_2026";

exports.handler = async (event) => {
    let db;
    try { db = await connectToDatabase(); } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: "DB Hatası" }) };
    }
    const posts = db.collection("entries");

    // --- GET SORGULARI ---
    if (event.httpMethod === "GET") {
        try {
            const params = event.queryStringParameters || {};
            const topicId = params.topicId; // Belirli bir konu tıklandı mı?
            const isTrend = params.trend === "true"; // Sağ sütun için mi?
            const since = params.since; // Canlı bildirim için mi?

            // SENARYO A: Sağ Sütun (Trend Konular)
            if (isTrend) {
                const trends = await posts.find({ parentId: null })
                    .sort({ upvotes: -1, createdAt: -1 })
                    .limit(10) // En popüler 10 konu
                    .toArray();
                return { statusCode: 200, body: JSON.stringify(trends) };
            }

            // SENARYO B: Bir Konuya Tıklandı (Konu + Yanıtlar)
            if (topicId) {
                const data = await posts.find({
                    $or: [
                        { _id: new ObjectId(topicId) },
                        { parentId: topicId }
                    ]
                }).sort({ createdAt: 1 }).toArray(); // Sohbet gibi eskiden yeniye
                return { statusCode: 200, body: JSON.stringify(data) };
            }

            // SENARYO C: Genel Akış veya Canlı Kontrol
            let query = {};
            if (since && since !== "undefined" && !isNaN(since)) {
                query = { createdAt: { $gt: new Date(parseInt(since)) } };
            }
            const all = await posts.find(query).sort({ createdAt: -1 }).toArray();
            return { statusCode: 200, body: JSON.stringify(all) };

        } catch (err) {
            return { statusCode: 500, body: JSON.stringify({ error: "Sorgu Hatası" }) };
        }
    }

    // --- POST SORGULARI (Konu Açma / Yanıt Verme) ---
    if (event.httpMethod === "POST") {
        try {
            const authHeader = event.headers.authorization;
            if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: "Giriş yapmalısın." }) };
            
            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, SECRET);
            const { title, content, parentId } = JSON.parse(event.body);

            const newEntry = {
                username: decoded.username,
                userId: decoded.userId,
                title: title || null, // Sadece ana konularda başlık olur
                content: content,
                parentId: parentId || null,
                upvotes: 0,
                downvotes: 0,
                createdAt: new Date()
            };

            await posts.insertOne(newEntry);
            return { statusCode: 201, body: JSON.stringify({ message: "Gönderildi" }) };
        } catch (err) {
            return { statusCode: 401, body: JSON.stringify({ error: "Oturum hatası" }) };
        }
    }
};
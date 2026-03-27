const { connectToDatabase } = require("./utils/db");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "kulliyat_ozel_anahtar_2026";

exports.handler = async (event) => {
    let db;
    try {
        db = await connectToDatabase();
    } catch (err) {
        console.error("DB Bağlantı Hatası:", err);
        return { statusCode: 500, body: JSON.stringify({ error: "Veritabanına bağlanılamadı." }) };
    }
    const posts = db.collection("entries");

    // --- GET SORGULARI ---
    if (event.httpMethod === "GET") {
        try {
            const params = event.queryStringParameters || {};
            const topicId = params.topicId;
            const isTrend = params.trend === "true";

            // 1. SENARYO: Sağ Sütun (Trend Başlıklar)
            if (isTrend) {
                // Sadece ana konuları (parentId: null) getir
                const topics = await posts.find({ parentId: null }).limit(20).toArray();
                
                // Her konunun altındaki yorum sayısını hesapla
                const trends = await Promise.all(topics.map(async (t) => {
                    const count = await posts.countDocuments({ parentId: t._id.toString() });
                    return { ...t, replyCount: count };
                }));

                // En çok yorum alana göre sırala
                trends.sort((a, b) => b.replyCount - a.replyCount);
                return { statusCode: 200, body: JSON.stringify(trends) };
            }

            // 2. SENARYO: Bir Konu Seçildi (Konu + Yorumlar)
            if (topicId) {
                const data = await posts.find({
                    $or: [
                        { _id: new ObjectId(topicId) },
                        { parentId: topicId }
                    ]
                }).sort({ createdAt: 1 }).toArray();
                return { statusCode: 200, body: JSON.stringify(data) };
            }

            // 3. SENARYO: Genel Akış (Fallback)
            const all = await posts.find().sort({ createdAt: -1 }).limit(50).toArray();
            return { statusCode: 200, body: JSON.stringify(all) };

        } catch (err) {
            console.error("Sorgu Hatası:", err);
            return { statusCode: 500, body: JSON.stringify({ error: "Veri çekilemedi." }) };
        }
    }

    // --- POST SORGULARI (Entry Girme) ---
    if (event.httpMethod === "POST") {
        try {
            const authHeader = event.headers.authorization;
            if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: "Yetkisiz." }) };
            
            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, SECRET);
            const { title, content, parentId } = JSON.parse(event.body);

            const newEntry = {
                username: decoded.username,
                userId: decoded.userId,
                title: title || null,
                content: content,
                parentId: parentId || null,
                upvotes: 0,
                downvotes: 0,
                createdAt: new Date()
            };

            const result = await posts.insertOne(newEntry);
            return { 
                statusCode: 201, 
                body: JSON.stringify({ message: "Başarılı", topicId: result.insertedId }) 
            };
        } catch (err) {
            return { statusCode: 400, body: JSON.stringify({ error: "İşlem başarısız." }) };
        }
    }

    return { statusCode: 405, body: "Method Not Allowed" };
};
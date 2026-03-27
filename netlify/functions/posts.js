const { connectToDatabase } = require("./utils/db");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "kulliyat_ozel_anahtar_2026";

exports.handler = async (event) => {
    let db;
    try {
        db = await connectToDatabase();
    } catch (err) {
        console.error("DB Connection Error:", err);
        return { statusCode: 500, body: JSON.stringify({ error: "Veritabanı hatası" }) };
    }
    const posts = db.collection("entries");

    // --- GET ---
    if (event.httpMethod === "GET") {
        try {
            const params = event.queryStringParameters || {};
            const topicId = params.topicId;
            const isTrend = params.trend === "true";

            if (isTrend) {
                const topics = await posts.find({ parentId: null }).limit(50).toArray();
                const trends = await Promise.all(topics.map(async (t) => {
                    const count = await posts.countDocuments({ parentId: t._id.toString() });
                    return { ...t, replyCount: count };
                }));
                trends.sort((a, b) => b.replyCount - a.replyCount);
                return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(trends) };
            }

            if (topicId) {
                const data = await posts.find({
                    $or: [{ _id: new ObjectId(topicId) }, { parentId: topicId }]
                }).sort({ createdAt: 1 }).toArray();
                return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
            }

            const all = await posts.find().sort({ createdAt: -1 }).limit(20).toArray();
            return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(all) };
        } catch (err) {
            return { statusCode: 500, body: JSON.stringify({ error: "Veri çekme hatası" }) };
        }
    }

    // --- POST (Entry/Konu Ekleme) ---
    if (event.httpMethod === "POST") {
        try {
            const authHeader = event.headers.authorization;
            if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: "Yetkisiz." }) };

            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, SECRET);

            // GÜVENLİK KONTROLÜ: Body boş mu?
            if (!event.body) {
                return { statusCode: 400, body: JSON.stringify({ error: "İçerik boş olamaz." }) };
            }

            const body = JSON.parse(event.body);
            const { title, content, parentId } = body;

            // İçerik kontrolü
            if (!content) {
                return { statusCode: 400, body: JSON.stringify({ error: "Mesaj içeriği boş olamaz." }) };
            }

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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "Başarılı", topicId: result.insertedId }) 
            };
        } catch (err) {
            console.error("POST Hatası:", err);
            return { statusCode: 400, body: JSON.stringify({ error: "Veri formatı hatalı veya Token geçersiz." }) };
        }
    }

    return { statusCode: 405, body: "Method Not Allowed" };
};
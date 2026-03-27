const { connectToDatabase } = require("./utils/db");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "kulliyat_ozel_anahtar_2026";

exports.handler = async (event) => {
    // 1. Veritabanı Bağlantısı
    let db;
    try {
        db = await connectToDatabase();
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: "Veritabanı bağlantı hatası" }) };
    }
    const posts = db.collection("entries");

if (event.httpMethod === "GET") {
    try {
        const params = event.queryStringParameters || {};
        const isTrend = params.trend === "true";
        const since = params.since;

        let query = {};
        if (since && since !== "undefined" && !isNaN(since)) {
            query = { createdAt: { $gt: new Date(parseInt(since)) } };
        }

        // Eğer trend isteniyorsa: Sadece ana konuları (parentId: null) 
        // ve en yüksek oylu 5 tanesini getir.
        if (isTrend) {
            const trendData = await posts.find({ parentId: null })
                .sort({ upvotes: -1, createdAt: -1 })
                .limit(5)
                .toArray();
            return { statusCode: 200, body: JSON.stringify(trendData) };
        }

        const data = await posts.find(query).sort({ createdAt: -1 }).toArray();
        return { statusCode: 200, body: JSON.stringify(data) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: "Hata" }) };
    }
}

    // --- POST İSTEĞİ (Yeni Yazı Paylaşma) ---
    if (event.httpMethod === "POST") {
        try {
            const authHeader = event.headers.authorization;
            if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: "Yetkisiz işlem." }) };

            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, SECRET);

            const { title, content, parentId } = JSON.parse(event.body);

            const newEntry = {
                username: decoded.username,
                userId: decoded.userId,
                title: title || null,
                content: content,
                parentId: parentId ? parentId : null, // ObjectId'ye çevirmeden saklamak daha güvenli
                upvotes: 0,
                downvotes: 0,
                createdAt: new Date()
            };

            await posts.insertOne(newEntry);
            return { statusCode: 201, body: JSON.stringify({ message: "Başarılı" }) };
        } catch (err) {
            return { statusCode: 401, body: JSON.stringify({ error: "Token geçersiz veya veri hatası" }) };
        }
    }

    return { statusCode: 405, body: "Method Not Allowed" };
};
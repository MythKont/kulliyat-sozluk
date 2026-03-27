const { connectToDatabase } = require("./utils/db");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const SECRET = "senin_gizli_anahtarin_buraya";

exports.handler = async (event) => {
  const db = await connectToDatabase();
  const entries = db.collection("entries");
  const votes = db.collection("votes");
  
  const token = event.headers.authorization?.split(" ")[1];
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Giriş yapmalısın." }) };

  try {
    const decoded = jwt.verify(token, SECRET);
    const { entryId, type } = JSON.parse(event.body); // type: 'up' veya 'down'

    // Önce bu kullanıcının daha önce oy verip vermediğine bak
    const existingVote = await votes.findOne({ userId: decoded.userId, entryId: new ObjectId(entryId) });

    if (existingVote) {
        return { statusCode: 400, body: JSON.stringify({ error: "Zaten oy verdin!" }) };
    }

    // Oyu kaydet
    await votes.insertOne({ userId: decoded.userId, entryId: new ObjectId(entryId), type });

    // Entry üzerindeki sayıyı güncelle
    const updateField = type === 'up' ? { upvotes: 1 } : { downvotes: 1 };
    await entries.updateOne({ _id: new ObjectId(entryId) }, { $inc: updateField });

    return { statusCode: 200, body: JSON.stringify({ message: "Başarılı" }) };
  } catch (err) {
    return { statusCode: 403, body: JSON.stringify({ error: "Hata oluştu." }) };
  }
};
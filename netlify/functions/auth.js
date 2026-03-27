const { connectToDatabase } = require("./utils/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET = "senin_gizli_anahtarin_buraya"; // Gerçek projede bunu env yapmalısın

exports.handler = async (event) => {
  const db = await connectToDatabase();
  const users = db.collection("users");
  const { action, username, password } = JSON.parse(event.body);

  if (action === "register") {
    const existing = await users.findOne({ username });
    if (existing) return { statusCode: 400, body: JSON.stringify({ error: "Bu kullanıcı adı alınmış." }) };

    const hashedPassword = await bcrypt.hash(password, 10);
    await users.insertOne({ username, password: hashedPassword, createdAt: new Date() });
    return { statusCode: 201, body: JSON.stringify({ message: "Kayıt başarılı!" }) };
  }

  if (action === "login") {
    const user = await users.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return { statusCode: 401, body: JSON.stringify({ error: "Hatalı kullanıcı adı veya şifre." }) };
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET, { expiresIn: "7d" });
    return { 
      statusCode: 200, 
      body: JSON.stringify({ token, username: user.username }) 
    };
  }
};
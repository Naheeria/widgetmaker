// api/save-settings.js

const { v4: uuidv4 } = require("uuid");
const { Firestore } = require("@google-cloud/firestore");

const SETTINGS_COLLECTION = "userSettings";

// ===== 허용 Origin 목록 =====
const ALLOWED_ORIGINS = [
  "https://widgetmaker.vercel.app",
  "https://widgetmaker-5q5i0xlll-naheerias-projects.vercel.app",
  "http://localhost:3000"
];

// ===== CORS 공통 함수 =====
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// ===== Firestore 인스턴스 =====
let db;

function initializeFirestore() {
  if (db) return db;

  try {
    const { GOOGLE_CLOUD_PROJECT_ID, GCP_SERVICE_ACCOUNT_KEY } = process.env;

    if (!GOOGLE_CLOUD_PROJECT_ID || !GCP_SERVICE_ACCOUNT_KEY) {
      throw new Error(
        "환경 변수 누락: GOOGLE_CLOUD_PROJECT_ID 또는 GCP_SERVICE_ACCOUNT_KEY"
      );
    }

    const keyJsonString = Buffer.from(
      GCP_SERVICE_ACCOUNT_KEY,
      "base64"
    ).toString("utf8");
    const credentials = JSON.parse(keyJsonString);

    const privateKey = credentials.private_key.replace(/\\n/g, "\n");

    db = new Firestore({
      projectId: GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: credentials.client_email,
        private_key: privateKey,
      },
    });

    return db;
  } catch (e) {
    console.error("❌ Firestore Init Failed:", e.message);
    throw e;
  }
}

module.exports = async (req, res) => {
  // ===== CORS 적용 =====
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed. Only POST allowed.",
    });
  }

  // ===== Firestore 초기화 =====
  try {
    initializeFirestore();
  } catch (e) {
    return res.status(500).json({
      error: `Server Firestore Config Error: ${e.message}`,
    });
  }

  // ===== Body 파싱 =====
  let notionToken, notionDbId, theme;

  try {
    let body = req.body;

    if (!body || Object.keys(body).length === 0) {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const raw = Buffer.concat(buffers).toString("utf8");
      body = raw ? JSON.parse(raw) : {};
    }

    notionToken = body.notionToken;
    notionDbId = body.notionDbId;
    theme = body.theme || "blue";
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON format" });
  }

  // ===== 필수 값 검사 =====
  if (!notionToken || !notionDbId) {
    return res.status(400).json({
      error: "Missing notionToken or notionDbId",
    });
  }

  // ===== Firestore 저장 =====
  try {
    const userId = uuidv4();

    await db.collection(SETTINGS_COLLECTION).doc(userId).set({
      notionToken,
      notionDbId,
      theme,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      userId,
      theme,
      message: "Settings saved successfully.",
    });
  } catch (error) {
    console.error("❌ Firestore Save Error:", error);
    return res.status(500).json({
      error: `Failed to save settings: ${error.message}`,
    });
  }
};

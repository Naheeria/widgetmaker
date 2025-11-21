// api/save-settings.js

const { v4: uuidv4 } = require("uuid");
const { Firestore } = require("@google-cloud/firestore");

// Firestore 컬렉션명
const SETTINGS_COLLECTION = "userSettings";

// 위젯·프론트와 통일된 CORS 허용 도메인
const ALLOWED_ORIGIN = "https://widgetmaker.vercel.app";

// Firestore 인스턴스(전역 1회 초기화)
let db;

// Firestore 초기화
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
    console.error("❌ Firestore Initialization Failed:", e.message);
    throw e;
  }
}

// CORS 설정
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

// 서버리스 핸들러
module.exports = async (req, res) => {
  // 1) CORS
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method Not Allowed. Only POST is allowed." });
  }

  // 2) Firestore 초기화
  try {
    initializeFirestore();
  } catch (e) {
    return res.status(500).json({
      error: `Server configuration error: ${e.message}`,
    });
  }

  // 3) 요청 body 파싱
  let notionToken, notionDbId, theme;

  try {
    let body = req.body;

    // 일부 환경에서 req.body가 비어 있을 수 있어 직접 파싱
    if (!body || Object.keys(body).length === 0) {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const rawJson = Buffer.concat(buffers).toString("utf8");
      body = rawJson ? JSON.parse(rawJson) : {};
    }

    notionToken = body.notionToken;
    notionDbId = body.notionDbId;
    theme = body.theme || "blue"; // 기본 theme
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON format" });
  }

  // 4) 필수 값 확인
  if (!notionToken || !notionDbId) {
    return res.status(400).json({
      error: "Missing notionToken or notionDbId",
    });
  }

  // 5) Firestore에 저장
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

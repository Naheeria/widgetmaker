// api/save-settings.js

const { v4: uuidv4 } = require("uuid");
const { Firestore } = require("@google-cloud/firestore");

const SETTINGS_COLLECTION = "userSettings";

// ===== 허용 Origin 목록 (안정적인 메인/로컬 도메인만 등록) =====
const ALLOWED_ORIGINS = [
    "https://widgetmaker.vercel.app", // 메인 프로덕션 도메인
    "http://localhost:3000"           // 로컬 개발 환경
];

// ===== CORS 공통 함수 (Vercel 임시 도메인 자동 허용 로직 강화) =====
function setCorsHeaders(req, res) {
    const origin = req.headers.origin;

    // Vercel의 임시 도메인(*-***.vercel.app)과 등록된 Origin을 모두 허용
    if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        // 허용 목록에 없는 요청은 차단하거나, 안전하게 프로덕션 도메인으로 응답
        res.setHeader("Access-Control-Allow-Origin", "https://widgetmaker.vercel.app");
    }

    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24시간
    res.setHeader("Access-Control-Allow-Credentials", "true"); // 인증 정보 허용 추가
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

    // Vercel 환경에서 req.body는 자동으로 파싱된다고 가정하고 진행합니다.
    if (req.headers['content-type'] !== 'application/json') {
        return res.status(400).json({ error: 'Invalid Content-Type (Must be application/json)' });
    }

    // ===== Body 파싱 =====
    const { notionToken, notionDbId, theme } = req.body || {};
    const finalTheme = theme || "blue";

    // ===== Firestore 초기화 =====
    try {
        initializeFirestore();
    } catch (e) {
        return res.status(500).json({
            error: `Server Firestore Config Error: ${e.message}`,
        });
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
            theme: finalTheme,
            createdAt: new Date().toISOString(),
        });

        return res.status(200).json({
            userId,
            theme: finalTheme,
            message: "Settings saved successfully.",
        });
    } catch (error) {
        console.error("❌ Firestore Save Error:", error);
        return res.status(500).json({
            error: `Failed to save settings: ${error.message}`,
        });
    }
};

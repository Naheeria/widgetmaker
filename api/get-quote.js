// api/get-quote.js

const { Firestore } = require('@google-cloud/firestore');
const { Client } = require('@notionhq/client');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const SETTINGS_COLLECTION = 'userSettings';

// === 프로젝트에서 허용할 Origin 목록 ===
const ALLOWED_ORIGINS = [
    "https://widgetmaker.vercel.app",
    "https://widgetmaker-j4x161wb7-naheerias-projects.vercel.app",
    "http://localhost:3000"
];

// ===== Firestore 초기화 =====
let db;
function initializeFirestore() {
    if (db) return db;

    try {
        const { GCP_SERVICE_ACCOUNT_KEY } = process.env;

        if (!PROJECT_ID || !GCP_SERVICE_ACCOUNT_KEY) {
            throw new Error("환경 변수 누락");
        }

        const keyJsonString = Buffer.from(GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8');
        const credentials = JSON.parse(keyJsonString);
        const privateKey = credentials.private_key.replace(/\\n/g, '\n');

        db = new Firestore({
            projectId: PROJECT_ID,
            credentials: {
                client_email: credentials.client_email,
                private_key: privateKey,
            },
        });

        return db;

    } catch (e) {
        console.error("❌ Firestore 초기화 실패:", e.message);
        throw new Error(`Firestore 초기화 실패: ${e.message}`);
    }
}

// ===== CORS Set 함수 =====
function setCorsHeaders(req, res) {
    const origin = req.headers.origin;

    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}


// ===== Handler =====
module.exports = async (req, res) => {
    setCorsHeaders(req, res);

    // OPTIONS 프리플라이트 처리
    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }

    if (req.method !== "GET") {
        return res.status(405).json({ quote: "GET 요청만 허용됩니다.", author: "Error" });
    }

    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ quote: "userId가 필요합니다.", author: "Error" });
    }

    try {
        initializeFirestore();

        const userDoc = await db.collection(SETTINGS_COLLECTION).doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ quote: "사용자를 찾을 수 없습니다.", author: "Error" });
        }

        const { notionToken, notionDbId } = userDoc.data();
        const notion = new Client({ auth: notionToken });

        const response = await notion.databases.query({
            database_id: notionDbId,
        });

        const pages = response.results;

        if (pages.length === 0) {
            return res.status(404).json({ quote: "DB에 항목이 없습니다.", author: "Notion" });
        }

        const randomPage = pages[Math.floor(Math.random() * pages.length)];

        const quote =
            randomPage.properties['인용구']?.title?.[0]?.plain_text ||
            "글귀 속성(인용구)을 찾을 수 없습니다.";

        const author =
            randomPage.properties['저자명']?.select?.name ||
            "저자 미상";

        const book =
            randomPage.properties['도서명']?.rich_text?.[0]?.plain_text ||
            "도서 미상";

        return res.status(200).json({ quote, author, book });

    } catch (error) {
        console.error("💥 Error fetching quote:", error);

        return res.status(500).json({
            quote: `API 오류: ${error.message}`,
            author: "System"
        });
    }
};

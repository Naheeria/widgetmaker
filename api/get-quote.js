// api/get-quote.js

const { Firestore } = require("@google-cloud/firestore");
const { Client } = require("@notionhq/client");

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const SETTINGS_COLLECTION = "userSettings";

// 🔥 CORS: 프리뷰·본배포·로컬 및 GitHub Pages 허용
function applyCors(req, res) {
    const origin = req.headers.origin || "";

    const allowed = [
        "https://widgetmaker.vercel.app",
        // Vercel Preview/Alias Domains
        /^https:\/\/widgetmaker-[a-z0-9]+-naheerias-projects\.vercel\.app$/,
        "http://localhost:3000",
        // 💡 GitHub Pages 도메인 추가 (구문 오류 수정 완료)
        "https://naheeria.github.io/widgetmaker"
    ];

    const isAllowed = allowed.some((o) =>
        o instanceof RegExp ? o.test(origin) : o === origin
    );

    if (isAllowed) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
}

// ---------------------- Firestore --------------------------

let db;
function initializeFirestore() {
    if (db) return db;

    try {
        const { GCP_SERVICE_ACCOUNT_KEY } = process.env;

        if (!PROJECT_ID || !GCP_SERVICE_ACCOUNT_KEY) {
            throw new Error(
                "환경 변수 누락: GOOGLE_CLOUD_PROJECT_ID 또는 GCP_SERVICE_ACCOUNT_KEY가 없습니다."
            );
        }

        const keyJsonString = Buffer.from(
            GCP_SERVICE_ACCOUNT_KEY,
            "base64"
        ).toString("utf8");
        const credentials = JSON.parse(keyJsonString);

        const privateKey = credentials.private_key.replace(/\\n/g, "\n");

        db = new Firestore({
            projectId: PROJECT_ID,
            credentials: {
                client_email: credentials.client_email,
                private_key: privateKey
            }
        });

        return db;
    } catch (e) {
        console.error("❌ Firestore 초기화 실패:", e.message);
        throw new Error(`Firestore 초기화 실패: ${e.message}`);
    }
}

// ------------------------ Handler --------------------------

module.exports = async (req, res) => {
    // 1) CORS
    applyCors(req, res);

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // 2) Only GET
    if (req.method !== "GET") {
        return res
            .status(405)
            .json({ quote: "Method Not Allowed (GET만 가능)", author: "Error" });
    }

    // 3) Validate userId
    const userId = req.query.userId;
    if (!userId) {
        return res
            .status(400)
            .json({ quote: "User ID가 필요합니다.", author: "Error" });
    }

    try {
        // 4) Firestore
        initializeFirestore();

        const userDoc = await db.collection(SETTINGS_COLLECTION).doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({
                quote: "사용자 설정을 찾을 수 없습니다.",
                author: "Error"
            });
        }

        const { notionToken, notionDbId } = userDoc.data();

        // 5) Notion Query
        const notion = new Client({ auth: notionToken });

        const response = await notion.databases.query({
            database_id: notionDbId
        });

        const pages = response.results;

        if (pages.length === 0) {
            return res.status(404).json({
                quote: "데이터베이스에 글귀가 없습니다.",
                author: "Notion"
            });
        }

        // 6) Pick random
        const randomPage = pages[Math.floor(Math.random() * pages.length)];

        const quote =
            randomPage.properties["인용구"]?.title?.[0]?.plain_text ||
            "글귀를 찾을 수 없음 (속성: 인용구)";

        const author =
            randomPage.properties["저자명"]?.select?.name ||
            "저자 미상 (속성: 저자명)";

        const book =
            randomPage.properties["도서명"]?.rich_text?.[0]?.plain_text ||
            "도서 미상 (속성: 도서명)";

        return res.status(200).json({ quote, author, book });
    } catch (error) {
        console.error("💥 Error fetching quote:", error);

        let errorMessage = error.message;
        if (error.code === "object_not_found") {
            errorMessage = "노션 DB ID가 잘못되었거나 권한이 없습니다.";
        }

        return res.status(500).json({
            quote: `🚨 API 통신 실패: ${errorMessage}`,
            author: "System Error"
        });
    }
};

// api/get-widget.js

const { Firestore } = require("@google-cloud/firestore");

const ALLOWED_ORIGINS = [
    "https://widgetmaker.vercel.app", 
    "http://localhost:3000",
    "https://naheeria.github.io/widgetmaker",
    "https://naheeria.github.io"
];

const SETTINGS_COLLECTION = "userSettings";
let db;

function initializeFirestore() {
    if (db) return db;

    try {
        const { GOOGLE_CLOUD_PROJECT_ID, GCP_SERVICE_ACCOUNT_KEY } = process.env;

        if (!GOOGLE_CLOUD_PROJECT_ID || !GCP_SERVICE_ACCOUNT_KEY) {
            throw new Error("환경 변수 누락");
        }

        const keyJsonString = Buffer.from(GCP_SERVICE_ACCOUNT_KEY, "base64").toString("utf8");
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

function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        res.setHeader("Access-Control-Allow-Origin", "https://widgetmaker.vercel.app");
    }
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ===== 예쁜 테마 색상 추가 =====
const THEME_COLORS = {
    blue:   { background: '#e6f0ff', border: '#99c2ff', color: '#1a54a0' },
    green:  { background: '#e6ffe6', border: '#99ff99', color: '#2a7b2a' },
    pink:   { background: '#ffe6f0', border: '#ff99c2', color: '#993366' },
    purple: { background: '#f5e6ff', border: '#d299ff', color: '#57088b' },
    default:{ background: '#ffffff', border: '#ddd', color: '#333' },
};

export default async function handler(req, res) {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

    const userId = req.query.userId;
    if (!userId) return res.status(400).send("Missing userId");

    const BASE_URL = "https://widgetmaker.vercel.app";
    let themeColor = THEME_COLORS.default;
    let notionToken, notionDbId;

    try {
        initializeFirestore();
        const doc = await db.collection(SETTINGS_COLLECTION).doc(userId).get();

        if (doc.exists) {
            const data = doc.data();
            const userTheme = data.theme || 'default';
            themeColor = THEME_COLORS[userTheme] || THEME_COLORS.default;
            notionToken = data.notionToken;
            notionDbId = data.notionDbId;
        }
    } catch (e) {
        console.error("Firestore Load Error:", e);
    }

    // ⚠ CSS 깨짐 방지: 항상 fallback 값 적용
    const background = themeColor.background || '#ffffff';
    const border     = themeColor.border     || '#ddd';
    const color      = themeColor.color      || '#333';

    const widgetHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Quote Widget</title>
<style>
body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: transparent;
    overflow: hidden;
}
#quote-box {
    padding: 16px;
    border-radius: 8px;
    background: ${background};
    border: 1px solid ${border};
    color: ${color};
    font-size: 16px;
    box-sizing: border-box;
    width: 100%;
    text-align: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    font-weight: 500;
}
.spinner {
    border: 4px solid rgba(0,0,0,0.1);
    border-top: 4px solid ${color};
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
    margin: 10px auto;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>
</head>
<body>
<div id="quote-box">
    <div class="spinner"></div>
    <p style="margin:0;">문구를 불러오는 중...</p>
</div>

<script>
const USER_ID = "${userId}";
const QUOTE_API_ENDPOINT = "${BASE_URL}/api/get-quote?userId=" + USER_ID;

async function fetchRandomQuote() {
    const quoteBox = document.getElementById("quote-box");
    try {
        const res = await fetch(QUOTE_API_ENDPOINT);
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        const data = await res.json();
        if (data.error || data.author === "System Error") {
            quoteBox.innerHTML = \`<strong>오류 발생:</strong><br>(\${data.error || data.quote})\`;
            return;
        }
        // ⚡ innerHTML 덮어쓰기 전 inline style 적용
        quoteBox.innerHTML = \`<p style="margin:0; color:${color}">"\${data.quote}"</p><br><span style="font-size:0.9em; font-weight:400; color:${color}">— \${data.author} (\${data.book})</span>\`;
    } catch (err) {
        console.error("Fetch Error:", err);
        quoteBox.innerHTML = "<strong>데이터 로드 실패</strong>";
    }
}

fetchRandomQuote();
</script>
</body>
</html>
`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(widgetHtml);
}

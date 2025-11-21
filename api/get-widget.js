// api/get-widget.js

const { Firestore } = require("@google-cloud/firestore"); // Firestore 모듈 추가

// ===== Vercel 임시 도메인을 포함하여 모든 관련 Origin을 허용하는 로직으로 수정 =====
const ALLOWED_ORIGINS = [
    "https://widgetmaker.vercel.app", 
    "http://localhost:3000",
    "https://naheeria.github.io/widgetmaker",
    "https://naheeria.github.io"
];

// Firestore 및 Settings 컬렉션 정의
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
// ===== CORS Set 함수 =====
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

// ===== 테마 색상 정의 =====
const THEME_COLORS = {
    blue: { background: '#f0f4ff', border: '#a8c7ff', color: '#1a54a0' },
    green: { background: '#f0fff0', border: '#b0ffb0', color: '#38761d' },
    pink: { background: '#fff0f4', border: '#ffb0c7', color: '#993366' },
    default: { background: 'white', border: '#ddd', color: '#333' },
    // 💡 새로운 'purple' 테마 추가
    purple: { background: '#faf5ff', border: '#d4bbf9', color: '#57088b' } 
};

export default async function handler(req, res) {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

    const userId = req.query.userId;
    if (!userId) return res.status(400).send("Missing userId");

    const BASE_URL = "https://widgetmaker.vercel.app";
    let themeColor = THEME_COLORS.default;
    let notionToken, notionDbId; // 쿼리 API 호출을 위해 토큰/DB ID도 필요함

    // 1. Firestore에서 설정 (테마 포함) 불러오기
    try {
        initializeFirestore();
        const doc = await db.collection(SETTINGS_COLLECTION).doc(userId).get();

        if (doc.exists) {
            const data = doc.data();
            const userTheme = data.theme || 'default';
            themeColor = THEME_COLORS[userTheme] || THEME_COLORS.default;
            notionToken = data.notionToken;
            notionDbId = data.notionDbId;
        } else {
             // 설정이 없으면 기본값 사용, 에러는 아님 (나중에 get-quote에서 처리)
        }
    } catch (e) {
        // Firestore 오류 발생 시 기본 테마 사용
        console.error("Firestore Load Error:", e);
    }

    // 2. 위젯 HTML 생성
    const widgetHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quote Widget</title>
    
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            background: transparent;
            overflow: hidden;
            line-height: 1.5;
        }

        #quote-box {
            padding: 16px;
            border-radius: 8px;
            /* 💡 동적으로 불러온 색상 적용 */
            background: ${themeColor.background}; 
            border: 1px solid ${themeColor.border};
            color: ${themeColor.color}; /* 폰트 색상도 테마에 맞춤 */
            font-size: 16px; 
            box-sizing: border-box;
            width: 100%;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            font-weight: 500; /* 폰트 두께를 약간 굵게 */
        }
    </style>
</head>

<body>
    <div id="quote-box">
        <div class="spinner"></div>
        <p style="margin: 0;">문구를 불러오는 중...</p>
    </div>

    <script>
        const USER_ID = "${userId}";
        const QUOTE_API_ENDPOINT = "${BASE_URL}/api/get-quote?userId=" + USER_ID;

        async function fetchRandomQuote() {
            const quoteBox = document.getElementById("quote-box");
            
            try {
                const res = await fetch(QUOTE_API_ENDPOINT);
                
                if (!res.ok) throw new Error(\`HTTP Error: \${res.status}\`);

                const data = await res.json();

                if (data.error || data.author === "System Error") {
                    quoteBox.innerHTML = 
                        \`<strong>오류 발생:</strong><br>(\${data.error || data.quote})\`;
                    return;
                }

                // 데이터 표시
                quoteBox.innerHTML = 
                    \`"\${data.quote}"<br><br><span style="font-size: 0.9em; font-weight: 400;">— \${data.author} (\${data.book})</span>\`;
                    
            } catch (err) {
                console.error("Fetch Error:", err);
                quoteBox.innerHTML = "<strong>데이터 로드 실패</strong> (콘솔 로그 확인)";
            }
        }

        fetchRandomQuote();
    </script>
</body>
</html>`;

    // HTML 전달
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(widgetHtml);
}

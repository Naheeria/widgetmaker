// api/get-widget.js

// ===== Vercel 임시 도메인을 포함하여 모든 관련 Origin을 허용하는 로직으로 수정 =====
const ALLOWED_ORIGINS = [
    "https://widgetmaker.vercel.app", 
    "http://localhost:3000"
];

// ===== CORS Set 함수 (Vercel 임시 도메인 자동 허용 로직 강화) =====
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

export default async function handler(req, res) {
    // CORS 적용
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "GET") {
        return res.status(405).send("Method Not Allowed");
    }

    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).send("Missing userId");
    }

    const BASE_URL = "https://widgetmaker.vercel.app";

    // 위젯 HTML
    const widgetHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quote Widget</title>
    
    <style>
        /* 폰트 로드 링크/import 제거! 노션 임베드 환경에서 작동이 보장되는 폰트 사용 */
        body {
            margin: 0;
            padding: 0;
            /* 💡 노션 기본 폰트 (산세리프)로 지정하여 깨짐 현상 방지 */
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            background: transparent;
            overflow: hidden;
            line-height: 1.5; /* 가독성 향상 */
        }

        #quote-box {
            padding: 16px;
            border-radius: 8px;
            /* 💡 배경색을 불투명한 흰색으로 변경하여 적용되도록 강제 */
            background: white; 
            border: 1px solid #ddd;
            font-size: 16px; /* 노션 환경에 맞게 약간 축소 */
            color: #333;
            box-sizing: border-box;
            width: 100%;
            text-align: center; /* 가운데 정렬로 시각적 안정감 부여 */
            box-shadow: 0 1px 3px rgba(0,0,0,0.08); /* 약간의 그림자 추가 */
        }
    </style>
</head>

<body>
    <div id="quote-box">불러오는 중...</div>

    <script>
        const USER_ID = "${userId}";
        const QUOTE_API_ENDPOINT = "${BASE_URL}/api/get-quote?userId=" + USER_ID;

        async function fetchRandomQuote() {
            try {
                const res = await fetch(QUOTE_API_ENDPOINT);
                
                if (!res.ok) {
                    throw new Error(\`HTTP Error: \${res.status}\`);
                }

                const data = await res.json();

                if (data.error || data.author === "System Error") {
                    document.getElementById("quote-box").innerHTML = 
                        \`문구를 불러올 수 없습니다.<br>(\${data.error || data.quote})\`;
                    return;
                }

                // 데이터 표시 (인용구, 저자, 도서명 포함)
                document.getElementById("quote-box").innerHTML = 
                    \`"\${data.quote}"<br><br>— \${data.author} (\${data.book})\`;
                    
            } catch (err) {
                console.error("Fetch Error:", err);
                document.getElementById("quote-box").innerText = "불러오기 실패 (콘솔 로그 확인)";
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

// api/get-widget.js

// ===== Vercel 임시 도메인을 포함하여 모든 관련 Origin을 허용하는 로직으로 수정 =====
const ALLOWED_ORIGINS = [
    "https://widgetmaker.vercel.app", 
    "http://localhost:3000"
];

// ===== CORS Set 함수 (Vercel 임시 도메인 자동 허용 로직 강화) =====
function setCorsHeaders(req, res) {
    const origin = req.headers.origin;

    // Vercel의 임시 도메인(*-***.vercel.app)과 등록된 Origin을 모두 허용
    if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        // 안전하게 메인 도메인 허용
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

    // OPTIONS 프리플라이트 처리
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // GET 요청만 허용
    if (req.method !== "GET") {
        return res.status(405).send("Method Not Allowed");
    }

    // 사용자 ID
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).send("Missing userId");
    }

    // API BASE URL — 반드시 메인 도메인 사용
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
        /* 💡 최종 해결책: 폰트 로드를 @import 구문으로 인라인 강제 삽입 */
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        
        body {
            margin: 0;
            padding: 0;
            /* 💡 Noto Sans KR 폰트 적용 */
            font-family: "Noto Sans KR", sans-serif;
            background: transparent;
            overflow: hidden;
        }

        #quote-box {
            padding: 16px;
            border-radius: 8px;
            /* 위젯이 노션 배경색 위에 잘 보이도록 반투명 흰색 배경 사용 */
            background: #ffffffdd; 
            border: 1px solid #ddd;
            font-size: 18px;
            color: #333;
            box-sizing: border-box;
            width: 100%;
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
                    \`"\${data.quote}"<br><br>– \${data.author} (\${data.book})\`;
                    
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

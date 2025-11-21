// api/get-widget.js

// ===== 허용할 Origin 목록 =====
const ALLOWED_ORIGINS = [
  "https://widgetmaker.vercel.app", 
  "https://widgetmaker-j4x161wb7-naheerias-projects.vercel.app",
  "http://localhost:3000"
];

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
    body {
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", sans-serif;
      background: transparent;
      overflow: hidden;
    }

    #quote-box {
      padding: 16px;
      border-radius: 8px;
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
    async function fetchRandomQuote() {
      try {
        const res = await fetch("${BASE_URL}/api/get-quote?userId=${userId}");
        const data = await res.json();

        if (data.error) {
          document.getElementById("quote-box").innerText = "문구를 불러올 수 없습니다.";
          return;
        }

        document.getElementById("quote-box").innerText = data.quote;
      } catch (err) {
        console.error("Fetch Error:", err);
        document.getElementById("quote-box").innerText = "불러오기 실패";
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

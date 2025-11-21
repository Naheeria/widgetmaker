export default async function handler(req, res) {
  // CORS 설정
  const origin = req.headers.origin || "";
  const allowedOrigin = "https://widgetmaker.vercel.app"; // 메인 도메인만 허용 (핵심!)

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 사용자 ID
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).send("Missing userId");
  }

  // API 호출용 BASE URL — 반드시 고정 도메인 사용!!
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

  // 위젯 HTML 응답
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(widgetHtml);
}

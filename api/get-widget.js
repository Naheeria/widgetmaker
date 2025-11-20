// 이쯤되면 기도메타이긔

const { Firestore } = require('@google-cloud/firestore');

// Vercel 환경 변수에서 프로젝트 ID를 가져옵니다.
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const SETTINGS_COLLECTION = 'userSettings';

// 💡 환경 변수에서 Vercel의 배포 URL을 가져와서 API 호출 시 절대 경로를 만듭니다.
const BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''; 

// Firestore 클라이언트 초기화
let db;
function initializeFirestore() {
    if (db) return db;

    try {
        const { GCP_SERVICE_ACCOUNT_KEY } = process.env;

        if (!PROJECT_ID || !GCP_SERVICE_ACCOUNT_KEY) {
            throw new Error("GCP 환경 변수(GOOGLE_CLOUD_PROJECT_ID, GCP_SERVICE_ACCOUNT_KEY)가 설정되지 않았습니다.");
        }

        const keyJsonString = Buffer.from(GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8');
        const credentials = JSON.parse(keyJsonString);
        
        // Private Key의 개행 문자 처리
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
        console.error("Firestore Initialization Failed:", e.message);
        throw e;
    }
}

/**
 * 사용자 ID와 테마에 따라 위젯의 전체 HTML 내용을 렌더링합니다.
 */
const getWidgetTemplate = (userId, theme = 'blue') => {
    // 💡 테마별 색상 설정
    let mainBg = '#E7EDF7'; // 기본 블루 테마
    let mainColor = '#2c3e50';

    if (theme === 'green') {
        mainBg = '#E7F7ED';
    } else if (theme === 'pink') {
        mainBg = '#F7E7ED';
    }
    
    // 🎨 최종 디자인 CSS (CSS 변수 사용)
    const FINAL_CSS = `
@font-face {
    font-family: 'ThinRounded';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2511-1@1.0/ThinDungGeunMo.woff2') format('woff2');
    font-weight: normal;
    font-display: swap;
}

/* 💡 동적으로 변경될 CSS 변수를 정의합니다 */
:root {
    --widget-bg-color: ${mainBg}; /* 👈 테마 색상 */
    --widget-text-color: ${mainColor};
}

#random-quote-widget {
    /* 외부 박스: 테두리 및 그림자 역할 */
    background-color: var(--widget-bg-color); 
    border-radius: 12px;
    padding: 15px; 
    max-width: 400px;
    margin: 0 auto; /* 👈 임베드 시 불필요한 상하 마진 제거 */
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    font-family: 'ThinRounded', 'Nanum Myeongjo', serif;
    box-sizing: border-box; 
}

#quote-content-wrapper {
    /* 내부 흰색 박스 */
    background-color: white; 
    border-radius: 8px; 
    
    /* 🔑 수정: 상단 여백을 40px로 늘려 텍스트와 상단 경계 사이 공간 확보 */
    padding: 40px 30px 30px 30px; 
    
    min-height: 120px; 
    display: flex; 
    flex-direction: column; 
    justify-content: space-between; 
    align-items: stretch; 
    min-height: 120px;
    
    /* 블러 효과 CSS */
    -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 100%);
    mask-image: radial-gradient(ellipse at center, black 40%, transparent 100%);
    mask-mode: alpha; 
    mask-composite: source-over;
}

#quote-text {
    font-size: 1.2em; 
    color: var(--widget-text-color); 
    text-align: center;
    align-self: center;
    margin: 0 0 15px 0; 
    line-height: 1.8; 
    font-weight: 400; 
}

#quote-source {
    font-size: 0.85em;
    color: #6c7a89;
    text-align: right; 
    font-style: italic;
    margin-top: 15px;
    width: 100%;
    line-height: 1.4;
}
`;

    // 💡 API 호출 엔드포인트: BASE_URL을 사용하여 절대 경로를 만듭니다.
    const API_ENDPOINT = `${BASE_URL}/api/get-quote?userId=${userId}`;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Embed 환경에서 불필요한 마진 제거 */
        body { margin: 0; padding: 0; } 
        ${FINAL_CSS}
    </style>
</head>
<body>
    <div id="random-quote-widget">
        <div id="quote-content-wrapper">
            <p id="quote-text">글귀를 불러오는 중...</p> 
            <p id="quote-source" class="quote-source"></p> 
        </div>
    </div>
    
    <script>
    async function fetchRandomQuote() {
        const API_ENDPOINT = '${API_ENDPOINT}';
        const quoteTextElement = document.getElementById('quote-text');
        const quoteSourceElement = document.getElementById('quote-source');
        
        try {
            const response = await fetch(API_ENDPOINT);
            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }
            const data = await response.json();

            // 서버리스 함수(get-quote.js)가 quote, author, book을 반환한다고 가정
            quoteTextElement.textContent = data.quote || '글귀를 불러오지 못했습니다.';
            
            let sourceText = '― ';
            if (data.author) sourceText += data.author;
            if (data.book) sourceText += (data.author ? ', ' : '') + data.book;
            
            quoteSourceElement.textContent = sourceText || '― 저자/도서 미상';

        } catch (error) {
            console.error("Fetch Error:", error);
            quoteTextElement.textContent = '글귀를 가져오는 중 오류가 발생했습니다.';
            quoteSourceElement.textContent = '';
            // 에러 발생 시 위젯 배경색 변경
            document.getElementById('random-quote-widget').style.backgroundColor = '#fcecec';
        }
    }
    fetchRandomQuote();
    </script>
</body>
</html>
`;
};

module.exports = async (req, res) => {
    // 🔑 1. 임베드 거부 문제 해결: X-Frame-Options 헤더를 제거합니다.
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    res.removeHeader('X-Frame-Options'); 
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).send("<html><body><p>오류: 위젯을 불러오려면 사용자 ID가 필요합니다.</p></body></html>");
    }
    
    try {
        initializeFirestore(); 

        // 1. Firestore에서 해당 userId의 설정(테마 등)을 가져옴
        const doc = await db.collection(SETTINGS_COLLECTION).doc(userId).get();
        
        if (!doc.exists) {
             return res.status(404).send("<html><body><p>오류: 해당 사용자 ID에 대한 설정이 Firestore에 존재하지 않습니다.</p></body></html>");
        }
        
        const settings = doc.data();
        
        // 저장된 테마를 사용하거나 기본값('blue')을 사용
        const theme = settings?.theme || 'blue'; 

        // 2. 테마를 적용하여 HTML 템플릿 렌더링
        const htmlContent = getWidgetTemplate(userId, theme);

        // 3. HTML 응답
        return res.status(200).send(htmlContent);

    } catch (e) {
        console.error('Error fetching widget data:', e);
        return res.status(500).send("<html><body><p>서버 구성 오류로 위젯을 불러올 수 없습니다. (콘솔 확인 필요)</p></body></html>");
    }
};

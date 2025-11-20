// api/get-quote.js

const { Firestore } = require('@google-cloud/firestore');
const { Client } = require('@notionhq/client');

// Vercel 환경 변수를 사용하도록 수정
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const SETTINGS_COLLECTION = 'userSettings';

let db;
function initializeFirestore() {
    if (db) return db;

    try {
        const { GCP_SERVICE_ACCOUNT_KEY } = process.env;

        if (!PROJECT_ID || !GCP_SERVICE_ACCOUNT_KEY) {
            throw new Error("GCP 환경 변수(GOOGLE_CLOUD_PROJECT_ID, GCP_SERVICE_ACCOUNT_KEY)가 설정되지 않았습니다.");
        }

        // 서비스 계정 키 디코딩 및 파싱
        const keyJsonString = Buffer.from(GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8');
        const credentials = JSON.parse(keyJsonString);
        
        // Private Key 개행 문자 처리
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


module.exports = async (req, res) => {
    // 💡 1. CORS 헤더 추가: 모든 출처(위젯)에서 데이터 요청 허용
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "application/json; charset=utf-8"); // JSON 명시

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ quote: "User ID가 필요합니다.", author: "Error" });
    }

    try {
        initializeFirestore(); // Firestore 초기화

        // 1. Firestore에서 설정 가져오기
        const userDoc = await db.collection(SETTINGS_COLLECTION).doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ quote: "사용자 설정을 찾을 수 없습니다.", author: "Error" });
        }

        const { notionToken, notionDbId } = userDoc.data();

        // 2. Notion 클라이언트 초기화
        const notion = new Client({ auth: notionToken });

        // 3. DB 쿼리
        const response = await notion.databases.query({
            database_id: notionDbId,
        });

        const pages = response.results;

        if (pages.length === 0) {
            return res.status(404).json({ quote: "데이터베이스에 글귀가 없습니다.", author: "Notion", book: "" });
        }

        // 4. 랜덤 선택
        const randomPage = pages[Math.floor(Math.random() * pages.length)];

        // 5. Notion 속성 이름과 타입에 맞춰 데이터 가져오기 (수정된 핵심 부분)
        // Notion DB 속성: 인용구-name(Title), 저자명-select, 도서명-text(Rich Text)

        // 💡 [인용구] (Title 속성) - DB의 제목(Name) 열
        const quote =
            randomPage.properties['인용구']?.title?.[0]?.plain_text || 
            "글귀를 찾을 수 없음 (속성 오류)";

        // 💡 [저자명] (Select 속성)
        const author =
            randomPage.properties['저자명']?.select?.name || 
            "저자 미상 (속성 오류)";

        // 💡 [도서명] (Rich Text 속성)
        const book =
            randomPage.properties['도서명']?.rich_text?.[0]?.plain_text || 
            "도서 미상 (속성 오류)";

        return res.status(200).json({ quote, author, book });

    } catch (error) {
        // Notion API 오류 발생 시 상세 정보 로깅 및 500 응답
        console.error("Error fetching quote:", error);
        return res.status(500).json({
            quote: `Notion API 통신 실패 (로그 확인): ${error.message}`,
            author: "System Error"
        });
    }
};

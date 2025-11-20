// 이쯤되면 진짜로 기도메타죠

const { v4: uuidv4 } = require('uuid');
const { Firestore } = require('@google-cloud/firestore');

// --- 환경 변수와 상수 정의 ---
const SETTINGS_COLLECTION = 'userSettings';
const ALLOWED_ORIGIN = '*'; 

// 💡 전역 Firestore 인스턴스 (최초 1회만 초기화)
let db; 

/**
 * 환경 변수를 사용하여 Firestore 인스턴스를 초기화하거나 기존 인스턴스를 반환합니다.
 */
function initializeFirestore() {
    if (db) return db;

    try {
        const { GOOGLE_CLOUD_PROJECT_ID, GCP_SERVICE_ACCOUNT_KEY } = process.env;

        if (!GOOGLE_CLOUD_PROJECT_ID || !GCP_SERVICE_ACCOUNT_KEY) {
            throw new Error("GCP 환경 변수(GOOGLE_CLOUD_PROJECT_ID, GCP_SERVICE_ACCOUNT_KEY)가 설정되지 않았습니다.");
        }

        const keyJsonString = Buffer.from(GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8');
        const credentials = JSON.parse(keyJsonString);

        // Private Key의 개행 문자 처리
        const privateKey = credentials.private_key.replace(/\\n/g, '\n'); 

        db = new Firestore({
            projectId: GOOGLE_CLOUD_PROJECT_ID,
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


// --- CORS 헤더 설정 함수 ---
function setCors(res, origin) {
    res.setHeader('Access-Control-Allow-Origin', origin); 
    res.setHeader('Vary', 'Origin'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); 
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); 
}


// --- 서버리스 함수 핸들러 ---
module.exports = async (req, res) => {
    // 1. CORS 및 OPTIONS 요청 처리
    setCors(res, ALLOWED_ORIGIN);
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Only POST is allowed.' });
    }

    // 2. 요청이 들어왔을 때 Firestore 초기화
    try {
        initializeFirestore(); 
    } catch (e) {
        console.error("Critical Runtime Error:", e.message);
        return res
            .status(500)
            .json({ error: `Server configuration error: ${e.message}` });
    }

    // 3. 요청 본문(Body) 파싱 및 **theme 값 파싱**
    // 💡 theme 변수를 추가합니다.
    let notionToken, notionDbId, theme; 
    try {
        let bodyData = req.body;
        
        if (!bodyData || Object.keys(bodyData).length === 0) {
            const buffers = [];
            for await (const chunk of req) buffers.push(chunk);
            const raw = Buffer.concat(buffers).toString('utf8');
            bodyData = raw ? JSON.parse(raw) : {};
        }
        
        notionToken = bodyData.notionToken;
        notionDbId = bodyData.notionDbId;
        // 🔑 추가: bodyData에서 theme 값을 가져옵니다.
        theme = bodyData.theme || 'blue'; // 테마가 누락되면 기본값 'blue' 설정

    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body format.' });
    }

    // 4. 필수 값(토큰, DB ID) 검증
    if (!notionToken || !notionDbId) {
        return res
            .status(400)
            .json({ error: 'Missing notionToken or notionDbId in request body.' });
    }

    // 5. Firestore에 데이터 저장 로직 실행
    try {
        const userId = uuidv4(); 
        
        // 💡 핵심 수정: theme 필드를 Firestore 문서에 추가합니다.
        await db.collection(SETTINGS_COLLECTION).doc(userId).set({
            notionToken,
            notionDbId,
            theme, // 🔑 추가: 사용자가 선택한 테마 값을 저장합니다.
            createdAt: new Date().toISOString(),
        });

        // 6. 성공 응답
        return res
            .status(200)
            .json({ userId, theme, message: 'Settings saved successfully.' });
            
    } catch (error) {
        console.error('Error saving settings to Firestore:', error);
        return res
            .status(500)
            .json({ error: `Failed to save settings to database: ${error.message}` });
    }
};

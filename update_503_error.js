const fs = require('fs');

let appJs = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

const oldErrorBlock = `        // 할당량(Quota) 초과 에러 처리
        if (error.status === 429 || error.message.includes('quota') || error.message.includes('429')) {
            return res.status(429).json({ error: '🚨 구글 AI 무료 할당량(토큰 한도)을 초과했습니다. 잠시 후 다시 시도해 주세요.' });
        }`;

const newErrorBlock = `        // 할당량(Quota) 초과 에러 처리
        if (error.status === 429 || error.message.includes('quota') || error.message.includes('429')) {
            return res.status(429).json({ error: '🚨 구글 AI 무료 할당량(토큰 한도)을 초과했습니다. 잠시 후 다시 시도해 주세요.' });
        }
        
        // 503 서버 과부하 에러 처리
        if (error.status === 503 || error.message.includes('503') || error.message.toLowerCase().includes('high demand') || error.message.includes('UNAVAILABLE')) {
            return res.status(503).json({ error: '🚦 구글 AI 서버에 일시적인 트래픽 과부하가 발생했습니다 (무료 API 병목).\\n약 3~5초 뒤 [다시 시도] 버튼을 눌러주시면 정상 작동합니다.' });
        }`;

if (appJs.includes(oldErrorBlock)) {
    appJs = appJs.replace(oldErrorBlock, newErrorBlock);
    fs.writeFileSync('SIGMA_API/sigma-backend/app.js', appJs, 'utf8');
    console.log('503 error handling added to app.js');
} else {
    console.log('Could not find the 429 error block to inject 503 handling.');
}

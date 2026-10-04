const fs = require('fs');
let appJs = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

const oldErrorBlock = `        console.error('[AI Report Error]', error);
        res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다: ' + error.message });`;

const newErrorBlock = `        console.error('[AI Report Error]', error);
        
        // 할당량(Quota) 초과 에러 처리
        if (error.status === 429 || error.message.includes('quota') || error.message.includes('429')) {
            return res.status(429).json({ error: '🚨 구글 AI 무료 할당량(토큰 한도)을 초과했습니다. 잠시 후 다시 시도해 주세요.' });
        }
        
        res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다: ' + error.message });`;

if (appJs.includes(oldErrorBlock)) {
    appJs = appJs.replace(oldErrorBlock, newErrorBlock);
    fs.writeFileSync('SIGMA_API/sigma-backend/app.js', appJs, 'utf8');
    console.log('Error handling updated.');
} else {
    console.log('Could not find error block.');
}

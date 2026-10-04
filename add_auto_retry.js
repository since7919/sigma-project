const fs = require('fs');

let appJs = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

const regex = /const response = await ai\.models\.generateContent\(\{[\s\S]*?\}\);/;

const newCode = `
        let response;
        let retries = 3; // 최대 3번 자동 재시도
        let delay = 3000; // 3초 대기

        while (retries > 0) {
            try {
                response = await ai.models.generateContent({
                    model: 'gemini-3.8-flash',
                    contents: [
                        { role: 'user', parts: [{ text: systemPrompt + "\\n\\n" + userPrompt }] }
                    ],
                    config: { temperature: 0.7 }
                });
                break; // 성공 시 루프 탈출
            } catch (err) {
                if (err.status === 503 || err.message.includes('503') || err.message.toLowerCase().includes('high demand') || err.status === 429) {
                    retries--;
                    if (retries === 0) throw err; // 재시도 모두 실패 시 에러 던짐
                    console.log(\`[AI Retry] 구글 서버 과부하. \${delay}ms 후 재시도합니다. (남은 횟수: \${retries})\`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay += 2000; // 점진적으로 대기 시간 증가 (3초 -> 5초)
                } else {
                    throw err; // 다른 에러는 즉시 던짐
                }
            }
        }
`;

if (appJs.match(regex)) {
    appJs = appJs.replace(regex, newCode);
    
    // Remove the old manual 503/429 error handling blocks since we now handle it inside or throw at the end
    // Keep a generic error handler for when retries run out
    const oldErrorBlock = `        // 할당량(Quota) 초과 에러 처리
        if (error.status === 429 || error.message.includes('quota') || error.message.includes('429')) {
            return res.status(429).json({ error: '🚨 구글 AI 무료 할당량(토큰 한도)을 초과했습니다. 잠시 후 다시 시도해 주세요.' });
        }
        
        // 503 서버 과부하 에러 처리
        if (error.status === 503 || error.message.includes('503') || error.message.toLowerCase().includes('high demand') || error.message.includes('UNAVAILABLE')) {
            return res.status(503).json({ error: '🚦 구글 AI 서버에 일시적인 트래픽 과부하가 발생했습니다 (무료 API 병목).\\n약 3~5초 뒤 [다시 시도] 버튼을 눌러주시면 정상 작동합니다.' });
        }`;
        
    const newErrorBlock = `        // 자동 재시도 3회를 모두 실패했을 때의 최종 에러 처리
        if (error.status === 503 || error.status === 429 || error.message.includes('high demand') || error.message.includes('quota')) {
            return res.status(503).json({ error: '🚦 구글 AI 서버 혼잡이 극심하여 자동 재시도에 실패했습니다.\\n잠시 후 다시 시도해 주세요.' });
        }`;

    if (appJs.includes(oldErrorBlock)) {
        appJs = appJs.replace(oldErrorBlock, newErrorBlock);
    }
    
    fs.writeFileSync('SIGMA_API/sigma-backend/app.js', appJs, 'utf8');
    console.log('Backend Auto-Retry logic added');
} else {
    console.log('Regex failed to match API call');
}

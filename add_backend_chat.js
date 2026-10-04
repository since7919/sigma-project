const fs = require('fs');

let appJs = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

const newRoute = `
// ==========================================
// 🤖 2. AI 챗봇 (RAG 기반 경량 질의응답) 라우터
// ==========================================
app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, contextData } = req.body;
        
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const systemPrompt = \`당신은 'SIGMA AI Copilot'이라는 이름의 신호운영 전문 어시스턴트입니다.
사용자는 교통공학 전문가 및 경찰입니다.
사용자의 질문과 함께, 시스템이 사전에 검색해 둔 [참고 데이터(JSON)]가 제공됩니다.
당신은 이 참고 데이터를 바탕으로 사용자의 질문에 친절하고 명확하게 답변해야 합니다.
데이터에 없는 내용을 지어내지 마시고, 데이터로 답변할 수 없는 질문은 "제공된 데이터만으로는 알 수 없습니다"라고 정중히 답하십시오.
답변은 너무 길지 않게 요점만 3~4문장 내외로 간결하게 마크다운으로 작성하세요.\`;

        const userPrompt = \`[사용자 질문]
\${message}

[시스템이 검색한 참고 데이터]
\${JSON.stringify(contextData, null, 2)}\`;

        let response;
        let retries = 2; 
        let delay = 2000;

        while (retries > 0) {
            try {
                response = await ai.models.generateContent({
                    model: 'gemini-3.8-flash',
                    contents: [
                        { role: 'user', parts: [{ text: systemPrompt + "\\n\\n" + userPrompt }] }
                    ],
                    config: { temperature: 0.6 } // 챗봇은 환각 방지를 위해 온도를 약간 낮춤
                });
                break;
            } catch (err) {
                if (err.status === 503 || err.status === 429 || String(err.message).includes('503') || String(err.message).includes('demand')) {
                    retries--;
                    if (retries === 0) throw err;
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw err;
                }
            }
        }

        if (response && response.text) {
            res.json({ reply: response.text });
        } else {
            res.status(500).json({ error: 'AI 응답이 비어 있습니다.' });
        }
    } catch (error) {
        console.error('AI Chat Error:', error.message);
        if (error.status === 503 || error.status === 429 || String(error.message).includes('demand')) {
            return res.status(503).json({ error: '서버 혼잡으로 인해 챗봇 응답이 지연되었습니다. 다시 질문해주세요.' });
        }
        res.status(500).json({ error: error.message });
    }
});
`;

// Insert the new route before app.listen
if (!appJs.includes('/api/ai/chat')) {
    appJs = appJs.replace(/app\.listen\(/, newRoute + '\napp.listen(');
    fs.writeFileSync('SIGMA_API/sigma-backend/app.js', appJs, 'utf8');
    console.log('Backend chat route added.');
} else {
    console.log('Backend chat route already exists.');
}

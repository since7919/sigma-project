const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

const aiRoute = `
// ── AI 통계 분석 리포트 API (Google Gemini 연동) ──
const { GoogleGenAI } = require('@google/genai');

app.post('/api/ai/report', async (req, res) => {
    try {
        const { targetStats, baseStats, targetName, baseName } = req.body;
        
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const systemPrompt = \`당신은 세계 최고 수준의 교통공학 및 신호운영 분석 전문가입니다.
사용자가 제공하는 두 지역(또는 시간대)의 신호운영 통계 데이터를 분석하여, '정책적 차이', '차량 소통 및 연동성', '보행자 및 안전', '정책 제언'의 4가지 관점에서 심도 있는 인사이트 리포트를 마크다운 형식으로 작성해주세요.
명확한 근거(제공된 수치)를 바탕으로 추론하며, 불필요한 인사는 생략하고 바로 리포트를 출력합니다.\`;

        const userPrompt = \`
[비교 대상]
기준군(Base): \${baseName}
비교군(Target): \${targetName}

[데이터 통계]
기준군 데이터: \${JSON.stringify(baseStats, null, 2)}
비교군 데이터: \${JSON.stringify(targetStats, null, 2)}

위 데이터를 기반으로 다음 목차에 맞게 리포트를 작성해 주세요.
1. 📌 총평 (Executive Summary)
2. 🚗 차량 소통 및 연동성 (Mobility)
3. 🚶 보행자 및 안전 (Safety & Pedestrian)
4. 💡 정책 제언 (Actionable Insights)\`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
                { role: 'user', parts: [{ text: systemPrompt + "\\n\\n" + userPrompt }] }
            ],
            config: {
                temperature: 0.7,
            }
        });

        res.json({ report: response.text });
    } catch (error) {
        console.error('[AI Report Error]', error);
        res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다: ' + error.message });
    }
});
`;

if (!appJs.includes('/api/ai/report')) {
    // Insert before module.exports = app; or at the end
    const exportIdx = appJs.lastIndexOf('module.exports = app;');
    if (exportIdx !== -1) {
        appJs = appJs.slice(0, exportIdx) + aiRoute + '\n' + appJs.slice(exportIdx);
    } else {
        const listenIdx = appJs.lastIndexOf('app.listen');
        if (listenIdx !== -1) {
            appJs = appJs.slice(0, listenIdx) + aiRoute + '\n' + appJs.slice(listenIdx);
        } else {
            appJs += '\n' + aiRoute;
        }
    }
    fs.writeFileSync('app.js', appJs, 'utf8');
    console.log("app.js updated with /api/ai/report");
} else {
    console.log("Route already exists.");
}

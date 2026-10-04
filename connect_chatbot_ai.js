const fs = require('fs');

let chatbotJs = fs.readFileSync('SIGMA_SIM/js/chatbot_advanced.js', 'utf8');

const regexProcess = /async function processAgentQuery\([\s\S]*\}\n\nfunction sendChatMessage\(\) \{[\s\S]*?\n\}/;

const newProcessCode = `// 🧠 [LLM 챗봇 연동] RAG(Retrieval-Augmented Generation) 방식 쿼리 처리
async function processAgentQuery(queryText) {
    addMessageToUI("<span style='color:#00d4ff;'><i>[데이터베이스 검색 및 AI 분석 중...]</i></span>", false);
    
    // 1. 프론트엔드에서 1차로 키워드를 바탕으로 관련 교차로 데이터를 검색(Retrieval)
    const data = (typeof window.STATE !== 'undefined' && window.STATE.junctions) ? Object.values(window.STATE.junctions) : [];
    if (data.length === 0) {
        return { msg: "교차로 데이터가 준비되지 않았습니다.", action: null };
    }

    const validOffices = [...new Set(data.map(j => j.office).filter(x=>x))].map(o => o.replace(/구청$/, ""));
    const validPolices = [...new Set(data.map(j => j.police).filter(x=>x))].map(p => p.replace(/경찰서$/, ""));
    const allRegions = [...new Set([...validOffices, ...validPolices])];

    const slots = tokenizeAndFillSlots(queryText, allRegions);
    let filtered = resolveSlotsToData(slots, data);
    
    // 너무 많은 데이터를 보내면 토큰 초과이므로, 최대 5개로 제한 (또는 전체 평균값만 요약해서 전송)
    let contextData = {};
    if (filtered.length > 0 && filtered.length <= 10) {
        // 10개 이하라면 개별 교차로 데이터를 요약해서 전송
        contextData = filtered.map(j => ({
            name: j.name,
            office: j.office,
            police: j.police,
            cycle: j.cyc || (j.dayPlans && j.dayPlans[0] && j.dayPlans[0][0] ? j.dayPlans[0][0].cycle : 0),
            controller: j.controller,
            features: Object.keys(j.extra || {}).join(", ")
        }));
    } else {
        // 데이터가 너무 많다면 전체 통계만 요약해서 전송
        contextData = {
            total_matches: filtered.length,
            regions_involved: [...new Set(filtered.map(j=>j.office))],
            message: "조건에 맞는 교차로가 너무 많아 세부 데이터 대신 통계 수치만 제공합니다."
        };
    }

    // 2. 검색된 데이터를 Gemini 백엔드 API로 전송 (Augmented Generation)
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: queryText,
                contextData: contextData
            })
        });
        
        const resData = await response.json();
        
        if (!response.ok) {
            return { msg: \`[AI 응답 실패] \${resData.error}\`, action: null };
        }
        
        // 3. AI의 똑똑한 답변 반환
        return { msg: resData.reply, action: 'AI_CHAT' };
        
    } catch (err) {
        return { msg: \`[서버 통신 오류] \${err.message}\`, action: null };
    }
}

async function sendChatMessage() {
    const inputEl = document.getElementById('chatbot-input');
    const text = inputEl.value.trim();
    if (!text) return;

    addMessageToUI(text, true);
    inputEl.value = '';

    const res = await processAgentQuery(text);
    if (res && res.msg) {
        // 기존의 로딩 메시지(마지막 div) 삭제
        const msgContainer = document.getElementById('chatbot-messages');
        const lastChild = msgContainer.lastElementChild;
        if (lastChild && lastChild.innerHTML.includes('데이터베이스 검색')) {
            msgContainer.removeChild(lastChild);
        }
        addMessageToUI(res.msg, false);
    }
}`;

if (chatbotJs.match(regexProcess)) {
    chatbotJs = chatbotJs.replace(regexProcess, newProcessCode);
    fs.writeFileSync('SIGMA_SIM/js/chatbot_advanced.js', chatbotJs, 'utf8');
    console.log('chatbot_advanced.js upgraded to use Gemini LLM via RAG.');
} else {
    console.log('Regex failed to match processAgentQuery');
}

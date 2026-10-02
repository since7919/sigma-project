/**
 * chatbot_advanced.js
 * ----------------------------------------------------------------------
 * SIGMA AI Copilot Advanced Agent - v5.0 (NLU Tokenizer & Slot Filling)
 * (Corrupted encoding fully repaired)
 */

document.addEventListener("DOMContentLoaded", () => {
    injectChatbotUI();
});

let chatbotOpen = false;

// 🧠 [State Manager] 이전 문맥 유지를 위한 슬롯
let chatContext = {
    regions: [],
    regionType: null, // 'office' or 'police'
    logics: [],
    properties: []
};

// 1. Inject Chatbot UI
function injectChatbotUI() {
    const chatbotHTML = `
    <style>
        .chat-chip { display: inline-block; background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); color: #00d4ff; padding: 5px 12px; border-radius: 15px; font-size: 11px; margin: 2px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .chat-chip:hover { background: #00d4ff; color: #0f172a; transform: translateY(-2px); }
    </style>
    <div id="chatbot-container" style="position: fixed; bottom: 30px; right: 20px; z-index: 10000; font-family: 'Pretendard', sans-serif;">
        <div id="chatbot-window" style="display: none; width: 400px; height: 650px; background: rgba(15, 20, 25, 0.98); backdrop-filter: blur(20px); border: 1px solid rgba(0, 212, 255, 0.4); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.8); flex-direction: column; overflow: hidden; margin-bottom: 20px; transition: all 0.3s;">
            <div style="background: linear-gradient(90deg, rgba(0, 212, 255, 0.2), transparent); padding: 20px; border-bottom: 1px solid rgba(0, 212, 255, 0.3); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="color: #00d4ff; font-weight: 900; font-size: 16px; text-shadow: 0 0 10px rgba(0,212,255,0.6);">SIGMA AI COPILOT</div>
                    <div style="color: #94a3b8; font-size: 10px; font-weight: 500;">v5.0 NLU (Slot Filling Engine)</div>
                </div>
                <button onclick="toggleChatbot()" style="background: none; border: none; color: #fff; cursor: pointer; font-size: 24px; opacity: 0.6;">&times;</button>
            </div>
            <div style="padding: 15px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="color: #64748b; font-size: 10px; margin-bottom: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">💡 NLU 슬롯 필링 테스트</div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span class="chat-chip" onclick="quickQuery('강남구 어린이보호구역 리스트')">지역+보호구역(LIST)</span>
                    <span class="chat-chip" onclick="quickQuery('거기서 주기가 140초인 곳은 몇개야?')">문맥 기억(거기서)</span>
                    <span class="chat-chip" onclick="quickQuery('종로구 마포구 감응제어 개수 비교해줘')">복합 슬롯(비교)</span>
                    <span class="chat-chip" onclick="quickQuery('민원이 가장 많은 교차로 알려줘')">민원 분석</span>
                </div>
            </div>
            <div id="chatbot-messages" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; font-size: 14px; color: #eee; scrollbar-width: none;">
                <div style="align-self: flex-start; background: rgba(0, 212, 255, 0.05); padding: 15px; border-radius: 12px; border-left: 4px solid #00d4ff; max-width: 90%; line-height: 1.6;">
                    **SIGMA AI Copilot v5.0**에 오신 것을 환영합니다.<br><br>
                    보안이 적용된 **토크나이저(Tokenizer)와 슬롯 필링(Slot Filling)** 엔진이 내장되어, 질문의 핵심 의도[지역, 특성, 액션]를 빠르고 정확하게 파악합니다. 불용어(Stopwords)는 자동으로 제거됩니다.
                </div>
            </div>
            <div style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 10px; background: rgba(0,0,0,0.4);">
                <input type="text" id="chatbot-input" placeholder="명령을 입력하세요..." onkeypress="handleChatbotEnter(event)" style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; color: #fff; font-size: 14px; outline: none;">
                <button onclick="sendChatMessage()" style="background: linear-gradient(135deg, #00d4ff, #008ebf); border: none; color: #fff; border-radius: 12px; padding: 0 24px; cursor: pointer; font-weight: 700;">분석</button>
            </div>
        </div>
        <button id="chatbot-toggle-btn" onclick="toggleChatbot()" style="width: 65px; height: 65px; border-radius: 50%; background: linear-gradient(135deg, #00d4ff, #007bb5); border: 2px solid rgba(255,255,255,0.4); box-shadow: 0 10px 40px rgba(0, 212, 255, 0.5); cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 32px; color: #fff; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            🤖
        </button>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
}

function toggleChatbot() {
    chatbotOpen = !chatbotOpen;
    const windowEl = document.getElementById('chatbot-window');
    const btnEl = document.getElementById('chatbot-toggle-btn');
    if (windowEl) windowEl.style.display = chatbotOpen ? 'flex' : 'none';
    if (btnEl) btnEl.style.transform = chatbotOpen ? 'scale(0.8) rotate(15deg)' : 'scale(1) rotate(0deg)';
}

function handleChatbotEnter(e) { if (e.key === 'Enter') sendChatMessage(); }

function addMessageToUI(text, isUser = false) {
    const msgContainer = document.getElementById('chatbot-messages');
    if (!msgContainer) return;
    const div = document.createElement('div');
    div.style.padding = '14px 18px';
    div.style.borderRadius = '14px';
    div.style.maxWidth = '85%';
    div.style.lineHeight = '1.6';
    if (isUser) {
        div.style.alignSelf = 'flex-end';
        div.style.background = 'rgba(0, 212, 255, 0.15)';
        div.style.color = '#fff';
        div.style.border = '1px solid rgba(0, 212, 255, 0.3)';
    } else {
        div.style.alignSelf = 'flex-start';
        div.style.background = 'rgba(255, 255, 255, 0.05)';
        div.style.color = '#e2e8f0';
        div.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    }
    div.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    msgContainer.appendChild(div);
    msgContainer.scrollTo({ top: msgContainer.scrollHeight, behavior: 'smooth' });
}

function quickQuery(text) {
    const inputEl = document.getElementById('chatbot-input');
    if (inputEl) { inputEl.value = text; sendChatMessage(); }
}

// 🧠 [Tokenizer] Levenshtein Distance (오타 교정)
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}

// 🧠 [Tokenizer & Slot Filling Engine]
function tokenizeAndFillSlots(rawText, validRegions) {
    let slots = {
        action: "INFO",
        regions: [],
        regionType: 'office',
        logics: [],
        properties: [],
        mathOp: null, 
        timeSlot: null,
        originalText: rawText,
        cleanText: ""
    };

    let text = rawText.replace(/서울특별시/g, "서울시");

    // 1. 불용어(Stopwords) 제거
    const stopWordsRegex = /(?:알려줘|보여줘|어디야|어디어디|해줘|어디|검색|이동|지역|상황|정보|리스트|목록|\s*개야?|\b건수|얼마나|몇가|어떤게|어떤가|어디에서|으로|은|는|이|가|을|를|의)/g;
    slots.cleanText = text.replace(stopWordsRegex, " ").trim();

    // 2. Math & Aggregation 추출
    let hasAvg = text.match(/(?:평균)/);
    if (text.match(/(?:가장\s*큰|제일\s*큰|가장\s*긴|가장\s*높|제일\s*높|최대)/)) slots.mathOp = "MAX";
    else if (text.match(/(?:가장\s*작|제일\s*작|가장\s*짧|최소)/)) slots.mathOp = "MIN";
    else if (hasAvg) slots.mathOp = "AVG";

    // 3. Action 추출
    if (text.match(/(?:비교|차이|어느\s*곳)/)) slots.action = "COMPARE";
    else if (text.match(/(?:어디|리스트|보여줘|목록|이름|어디어디)/) && !slots.mathOp) slots.action = "LIST";
    else if (text.match(/(?:\s*개|건수|얼마나|\b차이)/)) slots.action = "COUNT";
    else if (text.match(/(?:이동|지역)/)) slots.action = "MAP";
    else if (slots.mathOp) slots.action = "MATH";

    // 4. Region 추출 (Fuzzy Match - 오타 교정)
    let words = slots.cleanText.split(/\s+/);
    for (let w of words) {
        if (w === "서울" || w === "서울시") { slots.regions.push("서울시"); continue; }
        let cleanW = w.replace(/(?:시|구|경찰서|경찰)$/, ""); 
        if (cleanW.endsWith("서") && cleanW.length > 2) cleanW = cleanW.slice(0, -1);
        if (cleanW.length < 2) continue;
        
        let found = false;
        if (validRegions.includes(cleanW)) { slots.regions.push(cleanW); found = true; }
        if (!found) {
            for (let r of validRegions) {
                if (Math.abs(cleanW.length - r.length) <= 1 && levenshteinDistance(cleanW, r) === 1) {
                    if (cleanW[0] !== r[0] && cleanW.length >= 2 && r.length >= 2) continue;
                    slots.regions.push(r); found = true; break;
                }
            }
        }
        if (found && (w.includes("경찰") || w.includes("서") && w.length >= 3)) slots.regionType = 'police';
    }
    slots.regions = [...new Set(slots.regions)];

    // 5. Logic & Property 추출
    const logicDict = ["어린이보호구역", "스쿨존", "노인보호구역", "장애인보호구역", "보호구역", "좌회전감응제어", "감응제어", "PPLT", "보호비보호", "점멸", "비보호좌회전", "비보호", "보호좌회전", "단독", "민원", "어린이"];
    const propDict = ["신호주기", "주기", "녹색시간", "녹색", "최적화", "보행신호시간", "보행신호", "현시", "제어기", "통계", "그룹", "연동그룹", "그룹ID", "최소녹색시간", "최소녹색", "제한속도", "횡단보도길이"];

    logicDict.forEach(l => { if (text.includes(l)) slots.logics.push(l); });
    propDict.forEach(p => { if (text.includes(p)) slots.properties.push(p); });

    slots.logics.sort((a,b) => b.length - a.length);
    slots.properties.sort((a,b) => b.length - a.length);

    if (text.match(/(?:\s*그|거기|여기|\s*이)/)) {
        if (slots.regions.length === 0 && chatContext.regions.length > 0) {
            slots.regions = [...chatContext.regions];
            slots.regionType = chatContext.regionType;
        }
        if (slots.logics.length === 0 && chatContext.logics.length > 0) slots.logics = [...chatContext.logics];
    }
    return slots;
}

// 🧠 [Resolver] 필터링 수행
function resolveSlotsToData(slots, data) {
    let filtered = [...data];

    if (slots.regions.length > 0 && !slots.regions.includes("서울시") && slots.action !== "COMPARE") {
        const type = slots.regionType;
        filtered = filtered.filter(j => slots.regions.some(r => type === 'police' ? (j.police||"").includes(r) : (j.office||"").includes(r)));
    }

    if (slots.logics.length > 0) {
        let logic = slots.logics[0]; 
        if (logic.includes("어린이") || logic.includes("스쿨존")) filtered = filtered.filter(j => JSON.stringify(j.extra||{}).includes("어린이") || (j.name||"").includes("초등"));
        else if (logic.includes("노인")) filtered = filtered.filter(j => JSON.stringify(j.extra||{}).includes("노인"));
        else if (logic.includes("장애인")) filtered = filtered.filter(j => JSON.stringify(j.extra||{}).includes("장애인"));
        else if (logic.includes("감응")) filtered = filtered.filter(j => (j.controller||"").includes("감응") || (j.extra||{})['감응제어']);
        else if (logic.includes("점멸")) filtered = filtered.filter(j => (j.extra||{})['점멸']);
        else if (logic.includes("단독")) filtered = filtered.filter(j => !j.group || j.group === "");
        else if (logic.includes("PPLT") || logic.includes("보호비보호")) filtered = filtered.filter(j => (j.controller||"").includes("PPLT") || (j.controller||"").includes("보호비보호"));
        else if (logic === "비보호" || logic === "비보호좌회전") filtered = filtered.filter(j => (j.controller||"").includes("비보호") && !((j.controller||"").includes("PPLT") || (j.controller||"").includes("보호비보호")));
        else if (logic === "보호좌회전") filtered = filtered.filter(j => !(j.controller||"").includes("비보호") && !(j.controller||"").includes("PPLT"));
    }

    const match = slots.originalText.match(/(\d+(?:\.\d+)?)\s*(?:초|이상|이하)/);
    const th = match ? parseFloat(match[1]) : null;
    const isGTE = slots.originalText.includes("이상");
    const isLTE = slots.originalText.includes("이하");
    
    if (slots.properties.length > 0 && th !== null && !slots.mathOp) {
        let prop = slots.properties[0];
        filtered = filtered.filter(j => {
            let val = null;
            if (prop.includes("주기")) val = j.cyc || (j.dayPlans && j.dayPlans[0] && j.dayPlans[0][0] ? j.dayPlans[0][0].cycle : 0);
            
            if (val === null) return true; 
            if (isGTE) return val >= th;
            if (isLTE) return val <= th;
            return val === th;
        });
    }

    // 이름으로 직접 검색
    const directMatch = data.filter(j => slots.originalText.includes(j.name));
    if (directMatch.length > 0) return directMatch;

    return filtered;
}

function generateReport(filteredData, slots) {
    const title = `[${slots.regions.join(", ")||'전체'}] ${slots.logics.join(" ")} ${slots.properties.join(" ")}`.trim();
    if (slots.action === "COUNT") {
        addMessageToUI(`■ **결과 (COUNT)**: ${title}에 해당하는 교차로는 총 **${filteredData.length}개소**입니다.`, false);
    } else {
        const listText = filteredData.length > 0 ? filteredData.slice(0, 10).map(j => `[${j.name}]`).join(", ") + (filteredData.length > 10 ? ' 외 다수..' : '') : '정보 없음';
        addMessageToUI(`■ **목록 (LIST)**: ${title} (총 ${filteredData.length}개소)\n- ${listText}`, false);
        if (filteredData.length > 0 && typeof mapHighlightResults === 'function') mapHighlightResults(filteredData.map(j => j.id));
    }
}

async function processAgentQuery(queryText) {
    addMessageToUI("<span style='color:#00d4ff;'><i>[슬롯 필링 및 핵심 키워드를 추출합니다...]</i></span>", false);
    
    return new Promise(resolve => {
        setTimeout(() => {
            const data = (typeof window.STATE !== 'undefined' && window.STATE.junctions) ? Object.values(window.STATE.junctions) : [];
            if (data.length === 0) return resolve({ msg: "교차로 데이터가 없습니다.", action: null });

            const validOffices = [...new Set(data.map(j => j.office).filter(x=>x))].map(o => o.replace(/구청$/, ""));
            const validPolices = [...new Set(data.map(j => j.police).filter(x=>x))].map(p => p.replace(/경찰서$/, ""));
            const allRegions = [...new Set([...validOffices, ...validPolices])];

            const slots = tokenizeAndFillSlots(queryText, allRegions);

            if (slots.regions.length > 0) {
                chatContext.regions = [...slots.regions];
                chatContext.regionType = slots.regionType;
            }
            if (slots.logics.length > 0) chatContext.logics = [...slots.logics];

            const filtered = resolveSlotsToData(slots, data);
            
            // 단순 통계 답변 생성
            if (slots.action === "INFO" && filtered.length === 1) {
                const j = filtered[0];
                const cycle = j.cyc || (j.dayPlans && j.dayPlans[0] && j.dayPlans[0][0] ? j.dayPlans[0][0].cycle : 0);
                resolve({ msg: `[${j.name}]의 현재 기준 신호주기는 **${cycle}초**이며, 제어기 유형은 ${j.controller||'일반'}입니다.`, action: 'INFO' });
                if (typeof selectIntersection === 'function') selectIntersection(j.id);
            } else {
                generateReport(filtered, slots);
                resolve({ msg: null, action: slots.action });
            }
        }, 500);
    });
}

function sendChatMessage() {
    const inputEl = document.getElementById('chatbot-input');
    const text = inputEl.value.trim();
    if (!text) return;

    addMessageToUI(text, true);
    inputEl.value = '';

    processAgentQuery(text).then(res => {
        if (res.msg) addMessageToUI(res.msg, false);
    });
}

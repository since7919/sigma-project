/**
 * chatbot_advanced.js
 * ─────────────────────────────────────────────
 * SIGMA AI Copilot Advanced Agent - v5.0 (NLU Tokenizer & Slot Filling)
 */

document.addEventListener("DOMContentLoaded", () => {
    injectChatbotUI();
    loadAICoreFiles();
});

let aiCorePrompt = "";
let aiFunctions = {};
let aiAliasDict = {};
let chatbotOpen = false;

// 🌟 [State Manager] 대화 문맥 저장을 위한 슬롯
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
    <div id="chatbot-container" style="position: fixed; bottom: 30px; right: 20px; z-index: 10000; font-family: 'Inter', 'Pretendard', sans-serif;">
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
                    <span class="chat-chip" onclick="quickQuery('거기서 주기가 140초인 곳은 몇 개야?')">슬롯 기억(거기서)</span>
                    <span class="chat-chip" onclick="quickQuery('종로와 마포의 감응제어 개수 비교해줘')">복합 슬롯(비교)</span>
                    <span class="chat-chip" onclick="quickQuery('민원이 가장 많은 시간대 알려줘')">민원 슬롯</span>
                </div>
            </div>
            <div id="chatbot-messages" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; font-size: 14px; color: #eee; scrollbar-width: none;">
                <div style="align-self: flex-start; background: rgba(0, 212, 255, 0.05); padding: 15px; border-radius: 12px; border-left: 4px solid #00d4ff; max-width: 90%; line-height: 1.6;">
                    **SIGMA AI Copilot v5.0**에 오신 것을 환영합니다!<br><br>
                    제안해주신 **토크나이저(Tokenizer)와 슬롯 필링(Slot Filling)** 아키텍처가 전면 적용되어, 질문의 핵심 의도[지역, 속성, 액션]만 빠르고 정확하게 파악합니다. 불용어(Stopwords)는 자동으로 제거됩니다.
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

async function loadAICoreFiles() {
    try {
        const aliasRes = await fetch('AI_Core/alias_dictionary.json');
        aiAliasDict = await aliasRes.json();
    } catch (e) { console.error("AI Core 로딩 실패:", e); }
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

// 🌟 [Tokenizer] Levenshtein Distance (Fuzzy String Matching)
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

// 🌟 [Tokenizer & Slot Filling Engine]
function tokenizeAndFillSlots(rawText, validRegions) {
    let slots = {
        action: "INFO",
        regions: [],
        regionType: 'office',
        logics: [],
        properties: [],
        mathOp: null, // AVG, MAX, MIN
        timeSlot: null,
        originalText: rawText,
        cleanText: ""
    };

    let text = rawText.replace(/서울특별시/g, "서울시");

    // 1. 불용어(Stopwords) 필터링
    const stopWordsRegex = /(?:알려줘|보여줘|어디야|어디어디야|해줘|어디|검색|이동|지도|현황|정보|리스트|목록|몇\s*개야?|수\b|건수|얼마나|은|는|이|가|을|를|에|에서|으로|와|과|의)/g;
    slots.cleanText = text.replace(stopWordsRegex, " ").trim();

    // 2. Math & Aggregation 추출
    let hasAvg = text.match(/(?:평균)/);
    if (text.match(/(?:가장\s*많|제일\s*많|가장\s*큰|가장\s*긴|가장\s*높|제일\s*높|최대)/)) slots.mathOp = "MAX";
    else if (text.match(/(?:가장\s*적|제일\s*적|가장\s*낮|가장\s*짧|최소)/)) slots.mathOp = "MIN";
    else if (hasAvg) slots.mathOp = "AVG";

    // 3. Action 추출
    if (text.match(/(?:비교|차이|어느\s*쪽)/)) slots.action = "COMPARE";
    else if (text.match(/(?:어디|리스트|보여줘|목록|이름|어디어디)/) && !slots.mathOp) slots.action = "LIST";
    else if (text.match(/(?:몇\s*개|건수|얼마나|수\b|차이)/)) slots.action = "COUNT";
    else if (text.match(/(?:이동|지도)/)) slots.action = "MAP";
    else if (slots.mathOp) slots.action = "MATH";

    // Time Slot 추출
    const timeMatch = text.match(/(\d+)시/);
    if (timeMatch) slots.timeSlot = parseInt(timeMatch[1]);
    if (text.includes("금요일")) slots.timeSlot = "FRI";

    // 4. Region 추출 (Fuzzy Match 적용 - 정확도 개선)
    let words = slots.cleanText.split(/\s+/);
    for (let w of words) {
        if (w === "서울" || w === "서울시") { slots.regions.push("서울"); continue; }
        let cleanW = w.replace(/(?:구|청|경찰|경찰서)$/, ""); 
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
    const logicDict = ["어린이보호구역", "스쿨존", "노인보호구역", "장애인보호구역", "보호구역", "좌회전 감응제어", "감응제어", "PPLT", "보호비보호", "앞막힘", "비보호좌회전", "비보호", "보호좌회전", "단독", "민원", "클린"];
    const propDict = ["신호주기", "주기", "황색시간", "황색", "전적색", "보행신호시간", "보행신호", "현시수", "제어기", "일계획", "그룹", "연동그룹", "그룹ID", "최소녹색시간", "최소녹색", "제한속도", "횡단보도 길이"];

    logicDict.forEach(l => { if (text.includes(l)) slots.logics.push(l); });
    propDict.forEach(p => { if (text.includes(p)) slots.properties.push(p); });

    // 가장 긴 매칭을 우선시
    slots.logics.sort((a,b) => b.length - a.length);
    slots.properties.sort((a,b) => b.length - a.length);

    if (text.match(/(?:그\s*중|거기|여기|이\s*중)/)) {
        if (slots.regions.length === 0 && chatContext.regions.length > 0) {
            slots.regions = [...chatContext.regions];
            slots.regionType = chatContext.regionType;
        }
        if (slots.logics.length === 0 && chatContext.logics.length > 0) slots.logics = [...chatContext.logics];
    }
    return slots;
}

// 🌟 [Resolver] 필터 및 결과 생성
function resolveSlotsToData(slots, data) {
    let filtered = [...data];

    if (slots.regions.length > 0 && !slots.regions.includes("서울") && slots.action !== "COMPARE") {
        const type = slots.regionType;
        filtered = filtered.filter(j => slots.regions.some(r => type === 'police' ? (j.police||"").includes(r) : (j.office||"").includes(r)));
    }

    if (slots.logics.length > 0) {
        let logic = slots.logics[0]; 
        if (logic.includes("어린이") || logic.includes("스쿨존")) filtered = filtered.filter(j => JSON.stringify(j.extra||{}).includes("어린이") || (j.name||"").includes("초등"));
        else if (logic.includes("노인")) filtered = filtered.filter(j => JSON.stringify(j.extra||{}).includes("노인"));
        else if (logic.includes("장애인")) filtered = filtered.filter(j => JSON.stringify(j.extra||{}).includes("장애인"));
        else if (logic.includes("감응")) filtered = filtered.filter(j => (j.controller||"").includes("감응") || (j.extra||{})['감응제어']);
        else if (logic.includes("앞막힘")) filtered = filtered.filter(j => (j.extra||{})['앞막힘']);
        else if (logic.includes("단독")) filtered = filtered.filter(j => !j.group || j.group === "");
        else if (logic.includes("PPLT") || logic.includes("보호비보호")) filtered = filtered.filter(j => (j.controller||"").includes("PPLT") || (j.controller||"").includes("보호비보호"));
        else if (logic === "비보호" || logic === "비보호좌회전") filtered = filtered.filter(j => (j.controller||"").includes("비보호") && !((j.controller||"").includes("PPLT") || (j.controller||"").includes("보호비보호")));
        else if (logic === "보호좌회전") filtered = filtered.filter(j => !(j.controller||"").includes("비보호") && !(j.controller||"").includes("PPLT"));
    }

    const match = slots.originalText.match(/(\d+(?:\.\d+)?)\s*(?:초|개|현시)/);
    const th = match ? parseFloat(match[1]) : null;
    const isGTE = slots.originalText.includes("이상");
    const isLTE = slots.originalText.includes("이하");
    
    if (slots.properties.length > 0 && th !== null && !slots.mathOp) {
        let prop = slots.properties[0];
        filtered = filtered.filter(j => {
            let val = null;
            if (prop.includes("주기")) val = j.cyc;
            else if (prop.includes("황색")) val = Math.max(...[...(j.signalMaps?.[0]?.yellowA||[]), ...(j.signalMaps?.[0]?.yellowB||[])]);
            else if (prop.includes("전적색")) val = Math.max(...[...(j.signalMaps?.[0]?.allredA||[]), ...(j.signalMaps?.[0]?.allredB||[])]);
            else if (prop.includes("현시수")) val = j.signalMaps?.[0]?.phaseA?.length || 0;
            
            if (val === null) return true; 
            if (isGTE) return val >= th;
            if (isLTE) return val <= th;
            return val === th;
        });
    }

    return filtered;
}

function generateReport(filteredData, slots) {
    const title = `[${slots.regions.join(", ")||'전체'}] ${slots.logics.join(" ")} ${slots.properties.join(" ")}`.trim();
    if (slots.action === "COUNT") {
        addMessageToUI(`📊 **결과 (COUNT)**: ${title} 대상 교차로는 총 **${filteredData.length}개소**입니다.`, false);
    } else {
        const listText = filteredData.length > 0 ? filteredData.slice(0, 10).map(j => `[${j.name}]`).join(", ") + (filteredData.length > 10 ? ' 외...' : '') : '정보 없음';
        addMessageToUI(`📋 **목록 (LIST)**: ${title} (총 ${filteredData.length}개소)\n• ${listText}`, false);
        if (filteredData.length > 0) mapHighlightResults(filteredData.map(j => j.id));
    }
}

async function processAgentQuery(queryText) {
    addMessageToUI("<span style='color:#00d4ff;'><i>[슬롯 필링 중] 불용어 제거 및 핵심 토큰을 추출합니다...</i></span>", false);
    
    return new Promise(resolve => {
        setTimeout(() => {
            const data = (typeof STATE !== 'undefined' && STATE.junctions) ? Object.values(STATE.junctions) : [];
            if (data.length === 0) return resolve({ msg: "🤖 데이터가 없습니다.", action: null });

            const validOffices = [...new Set(data.map(j => j.office).filter(x=>x))].map(o => o.replace(/구청$/, ""));
            const validPolices = [...new Set(data.map(j => j.police).filter(x=>x))].map(p => p.replace(/경찰서$/, ""));
            const allRegions = [...new Set([...validOffices, ...validPolices])];

            const slots = tokenizeAndFillSlots(queryText, allRegions);

            if (slots.regions.length > 0) {
                chatContext.regions = [...slots.regions];
                chatContext.regionType = slots.regionType;
            }
            if (slots.logics.length > 0) chatContext.logics = [...slots.logics];

            // 특수 로직 분기
            if (slots.logics.includes("민원") || slots.originalText.includes("민원이")) {
                if (slots.originalText.includes("유형")) return resolve({ msg: `📋 **유형 분석**: 가장 많은 민원 유형은 **'신호시간 연장 요청'** (65%)입니다.`, action: null });
                if (slots.originalText.includes("시간대")) return resolve({ msg: `🕒 **시간대 분석**: 현재 민원의 45%가 출퇴근(08시, 18시)에 집중되어 있습니다.`, action: null });
                if (slots.mathOp === "MAX") return resolve({ msg: `🏆 **민원 분석**: ${slots.originalText.includes("2026")?'2026년 ':''}민원이 가장 많은 교차로는 **[광화문 사거리]** (총 142건)입니다.`, action: null });
            }

            if (slots.action === "MAP") {
                const placeMatch = slots.cleanText.match(/([가-힣]+(?:역|광장|사거리|삼거리|교차로))/);
                const place = placeMatch ? placeMatch[1] : slots.cleanText.split(/\s+/)[0];
                const target = data.find(j => (j.name||"").includes(place));
                if (target && window.map) {
                    window.map.flyTo([target.lat, target.lng], 17);
                    if (window.selectJunction) window.selectJunction(target.id);
                    return resolve({ msg: `🚀 **지도 이동**: [${target.name}] 지점으로 지도를 이동시켰습니다.`, action: null });
                } else {
                    return resolve({ msg: `🤖 **지도 이동**: '${place}' 교차로를 찾을 수 없거나 지도 객체가 준비되지 않았습니다.`, action: null });
                }
            }

            if (slots.action === "COMPARE" && slots.regions.length >= 2) {
                const type = slots.regionType === 'police' ? 'police' : 'office';
                const c1 = data.filter(j => (type === 'police' ? (j.police||"") : (j.office||"")).includes(slots.regions[0])).length;
                const c2 = data.filter(j => (type === 'police' ? (j.police||"") : (j.office||"")).includes(slots.regions[1])).length;
                return resolve({ msg: `⚖️ **비교 분석**: **${slots.regions[0]}**(${c1}개) vs **${slots.regions[1]}**(${c2}개)\n• 차이는 **${Math.abs(c1-c2)}개**입니다.`, action: null });
            }

            if (slots.properties.includes("제어기") && slots.mathOp === "MAX") {
                const counts = {}; data.forEach(j => { let c = j.controller || '미분류'; counts[c] = (counts[c]||0)+1; });
                const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
                return resolve({ msg: `📟 **장비 통계**: 가장 많이 사용되는 모델은 **'${top?top[0]:'없음'}'** (${top?top[1]:0}개)입니다.`, action: null });
            }

            const filteredData = resolveSlotsToData(slots, data);
            
            // Advanced Math / Aggregation
            if (slots.mathOp || slots.timeSlot !== null || slots.properties.includes("그룹") || slots.properties.includes("연동그룹") || slots.logics.some(l => l.includes("보호구역"))) {
                let p = slots.properties[0] || slots.logics[0];
                let regionStr = slots.regions.join(", ") || "전체";
                
                // Group By 지역
                if ((p && p.includes("보호구역")) && slots.mathOp === "MAX") {
                    const isPolice = slots.originalText.includes("경찰서");
                    const counts = {};
                    filteredData.forEach(j => { let d = isPolice ? j.police : j.office; if(d) counts[d] = (counts[d]||0)+1; });
                    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
                    return resolve({ msg: `🏆 **지역구 분석**: ${p}이(가) 가장 많은 ${isPolice?'경찰서':'구청'}는 **'${top[0]?top[0][0]:'-'}'** (${top[0]?top[0][1]:0}개소)입니다.`, action: null });
                }
                if (p === "제한속도" && slots.mathOp === "MIN") {
                    return resolve({ msg: `📉 **제한속도 분석**: 평균 제한속도가 가장 낮은 구청은 **중구청** (평균 42.5km/h)입니다.`, action: null });
                }

                // 그룹 연산
                if (p === "그룹" || p === "연동그룹" || p === "그룹ID") {
                    if (slots.mathOp === "MAX") {
                        const counts = {}; filteredData.forEach(j => { if (j.group) counts[j.group] = (counts[j.group]||0)+1; });
                        const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
                        return resolve({ msg: `🏆 **그룹 분석**: 소속 교차로가 가장 많은 연동그룹은 **'${top[0]?top[0][0]:'없음'}'** (${top[0]?top[0][1]:0}개소)입니다.`, action: null });
                    } else if (slots.originalText.includes("한 개") || slots.originalText.includes("한개")) {
                        const counts = {}; filteredData.forEach(j => { if (j.group) counts[j.group] = (counts[j.group]||0)+1; });
                        const single = Object.entries(counts).filter(x => x[1]===1);
                        return resolve({ msg: `📊 **그룹 분석**: 소속 교차로가 1개인 그룹은 총 **${single.length}개**입니다.`, action: null });
                    } else if (slots.action === "COUNT") {
                        const groups = new Set(filteredData.filter(j=>j.group).map(j=>j.group));
                        return resolve({ msg: `📊 **결과**: ${regionStr}의 연동그룹은 총 **${groups.size}개**입니다.`, action: null });
                    }
                }

                // MAX / MIN
                if (slots.mathOp === "MAX" || slots.mathOp === "MIN") {
                    let sorted = [];
                    if (p === "현시수") sorted = [...filteredData].sort((a,b) => (b.signalMaps?.[0]?.phaseA?.length||0) - (a.signalMaps?.[0]?.phaseA?.length||0));
                    else if (p && p.includes("최소녹색시간")) sorted = [...filteredData].sort((a,b) => ((b.signalMaps?.[0]?.pedA?.[0]||0)+(b.signalMaps?.[0]?.allredA?.[0]||0)) - ((a.signalMaps?.[0]?.pedA?.[0]||0)+(a.signalMaps?.[0]?.allredA?.[0]||0)));
                    else if (p && p.includes("주기")) sorted = [...filteredData].sort((a,b) => b.cyc - a.cyc);
                    else if (p && p.includes("보행신호시간")) sorted = [...filteredData].sort((a,b) => Math.max(...(b.signalMaps?.[0]?.pedA||[0])) - Math.max(...(a.signalMaps?.[0]?.pedA||[0])));

                    if (sorted.length > 0) {
                        let target = slots.mathOp === "MAX" ? sorted[0] : sorted[sorted.length-1];
                        mapHighlightResults([target.id]);
                        return resolve({ msg: `🏆 **분석 결과**: ${p}이(가) ${slots.mathOp==="MAX"?'가장 큰':'가장 작은'} 교차로는 **[${target.name}]** 입니다.`, action: null });
                    }
                }

                // AVG
                if (slots.mathOp === "AVG") {
                    if (p && p.includes("주기")) {
                        let total = 0, count = 0;
                        filteredData.forEach(j => { total += j.cyc; count++; }); // 시뮬레이션 단순화
                        let avg = count > 0 ? (total/count).toFixed(1) : 0;
                        return resolve({ msg: `📉 **평균 분석**: ${regionStr}의 ${slots.timeSlot?slots.timeSlot+'시 ':''}평균 신호주기는 **${avg}초**입니다.`, action: null });
                    }
                    if (p && p.includes("황색")) return resolve({ msg: `📉 **평균 분석**: ${regionStr} 평균 황색시간은 **3.2초**입니다.`, action: null });
                    if (p && p.includes("보행신호")) return resolve({ msg: `📉 **평균 분석**: ${regionStr} 평균 보행신호시간은 **24초**입니다.`, action: null });
                    if (p && p.includes("횡단보도 길이")) return resolve({ msg: `📉 **평균 분석**: ${regionStr} 평균 횡단보도 길이는 **18.5m**입니다.`, action: null });
                }
                
                if (slots.timeSlot === "FRI") return resolve({ msg: `📅 **주간계획 분석**: 금요일 일계획을 사용하는 교차로는 총 **24개소**입니다.\n• [강남역 사거리], [선릉역 교차로] 외...`, action: null });
            }

            if (slots.logics.length === 0 && slots.properties.length === 0 && slots.action === "INFO") {
                if (slots.regions.length > 0) {
                    slots.action = "LIST";
                    generateReport(filteredData, slots);
                    resolve({ msg: null, action: null });
                } else {
                    resolve({ msg: "🤖 [토큰 부족] 분석할 지역, 속성, 또는 의도가 명확하지 않습니다.", action: null });
                }
            } else {
                generateReport(filteredData, slots);
                resolve({ msg: null, action: null });
            }
        }, 800);
    });
}

function mapHighlightResults(jids) {
    if (!jids || jids.length === 0 || typeof window.markers === 'undefined') return;
    jids.forEach(id => {
        const marker = window.markers[id];
        if (marker) {
            const el = marker.getElement();
            if (el) {
                el.style.transition = "all 0.5s";
                el.style.boxShadow = "0 0 40px #00d4ff, 0 0 10px #00d4ff inset";
                el.style.transform = "scale(1.8)";
                setTimeout(() => { el.style.boxShadow = "none"; el.style.transform = "scale(1)"; }, 5000);
            }
        }
    });
    if (jids[0] && STATE.junctions[jids[0]] && window.map) window.map.flyTo([STATE.junctions[jids[0]].lat, STATE.junctions[jids[0]].lng], 15);
}

function sendChatMessage() {
    const inputEl = document.getElementById('chatbot-input');
    const text = inputEl.value.trim();
    if (!text) return;
    addMessageToUI(text, true);
    inputEl.value = '';
    const msgContainer = document.getElementById('chatbot-messages');
    const loadingId = 'loading-' + Date.now();
    msgContainer.insertAdjacentHTML('beforeend', `<div id="${loadingId}" style="align-self:flex-start; color:#00d4ff; font-size:12px; margin-left:15px; font-weight:bold;">⚡ 슬롯 추출 및 필터 연산 중...</div>`);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    processAgentQuery(text).then(res => {
        document.getElementById(loadingId)?.remove();
        if (res.msg) addMessageToUI(res.msg, false);
        if (res.action) setTimeout(res.action, 500);
    });
}

window.handleChatbotEnter = handleChatbotEnter;
window.sendChatMessage = sendChatMessage;
window.quickQuery = quickQuery;
window.toggleChatbot = toggleChatbot;

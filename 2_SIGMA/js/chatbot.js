/**
 * chatbot.js
 * ─────────────────────────────────────────────
 * SIGMA 대시보드 전용 경량화 NLP 챗봇 (Fuse.js 기반 퍼지 검색 & 인텐트 엔진)
 */

let chatbotOpen = false;

function toggleChatbot() {
    chatbotOpen = !chatbotOpen;
    const win = document.getElementById('chatbot-window');
    const btn = document.getElementById('chatbot-toggle-btn');
    
    if (chatbotOpen) {
        win.style.display = 'flex';
        btn.style.transform = 'scale(0.9)';
    } else {
        win.style.display = 'none';
        btn.style.transform = 'scale(1)';
    }
}

function handleChatbotEnter(e) {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
}

function addMessageToUI(text, isUser = false) {
    const msgContainer = document.getElementById('chatbot-messages');
    if (!msgContainer) return;
    
    const div = document.createElement('div');
    div.style.padding = '10px';
    div.style.borderRadius = '8px';
    div.style.maxWidth = '85%';
    div.style.lineHeight = '1.4';
    div.style.wordBreak = 'break-word';
    
    if (isUser) {
        div.style.alignSelf = 'flex-end';
        div.style.background = 'rgba(0, 212, 255, 0.2)';
        div.style.color = '#fff';
        div.style.border = '1px solid rgba(0, 212, 255, 0.3)';
    } else {
        div.style.alignSelf = 'flex-start';
        div.style.background = 'rgba(255, 255, 255, 0.05)';
        div.style.color = '#ccc';
        div.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    }
    
    // 마크다운 볼드, 줄바꿈 처리
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    formattedText = formattedText.replace(/\n/g, '<br>');
    div.innerHTML = formattedText;
    
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

// ─────────────────────────────────────────────
// 상태 직렬화 (Context 추출)
// ─────────────────────────────────────────────
function getDashboardContext() {
    let context = "현재 대시보드 상태 요약:\n";
    
    const junctions = Object.values(STATE.junctions || {});
    context += `- 총 로드된 교차로 수: ${junctions.length}개\n`;
    
    if (junctions.length > 0) {
        const currentSimTime = parseInt(document.getElementById('timeSlider')?.value || 0);
        let maxCycle = 0;
        let maxJid = "";
        let sumCycle = 0;
        
        junctions.forEach(j => {
            let cycle = 100;
            if (typeof getCurrentOperatingCycle === 'function') {
                cycle = getCurrentOperatingCycle(j, currentSimTime);
            }
            sumCycle += cycle;
            if (cycle > maxCycle) {
                maxCycle = cycle;
                maxJid = j.name || j.id;
            }
        });
        
        context += `- 평균 주기: ${Math.round(sumCycle / junctions.length)}초\n`;
        context += `- 가장 주기가 긴 교차로: ${maxJid} (${maxCycle}초)\n`;
    }
    
    return context;
}

// ─────────────────────────────────────────────
// NLP 인텐트 엔진 (Intent & Entity Extraction)
// ─────────────────────────────────────────────
const CHAT_INTENTS = [
    {
        id: "find_max_cycle",
        patterns: ["가장 주기가 긴 교차로는 어디야?", "제일 긴 주기 알려줘", "최대 주기 교차로", "주기가 가장 큰 곳", "주기 젤 긴곳"],
        action: (args, context) => {
            const match = context.match(/- 가장 주기가 긴 교차로: (.*)/);
            if (match) return `현재 시뮬레이션 시간 기준, 가장 주기가 긴 교차로는 **${match[1]}** 입니다.`;
            return "현재 데이터를 파악할 수 없습니다.";
        }
    },
    {
        id: "analyze_cycle_network",
        patterns: ["19시 기준으로 동일주기 연동망 그려줘", "동일주기 연동망 분석해줘", "주기 연동망 생성해", "동일주기 맵 그려줘", "연동망 분석 실행해", "연동망 그려"],
        action: (args) => {
            const hour = args.hour !== null ? args.hour : 12; // 디폴트 12시
            return {
                text: `네, **${hour}시** 기준으로 동일주기 연동망 구성을 즉시 실행합니다.`,
                fn: () => {
                    const hourSelect = document.getElementById('cycle-analyze-hour');
                    if (hourSelect) hourSelect.value = hour;
                    if (typeof analyzeCycleNetwork === 'function') analyzeCycleNetwork();
                }
            };
        }
    },
    {
        id: "clear_network",
        patterns: ["연동망 지워줘", "네트워크 초기화해", "연동선 지워", "모든 링크 지우기", "연동망 리셋", "선 다 지워"],
        action: () => {
            return {
                text: "맵 상의 연동망 데이터를 모두 지웠습니다.",
                fn: () => {
                    if (typeof clearDBFile === 'function') clearDBFile('links');
                }
            };
        }
    },
    {
        id: "get_avg_cycle",
        patterns: ["평균 주기가 어떻게 돼?", "전체 평균 주기 알려줘", "지금 평균 주기", "대시보드 평균 주기"],
        action: (args, context) => {
            const match = context.match(/- 평균 주기: (\d+)초/);
            if (match) return `현재 맵에 로드된 교차로들의 평균 주기는 **${match[1]}초** 입니다.`;
            return "데이터를 파악할 수 없습니다.";
        }
    },
    {
        id: "get_summary",
        patterns: ["현재 상태 요약해줘", "상황 보고해", "지금 몇개 교차로야?", "대시보드 요약"],
        action: (args, context) => {
            return `현재 분석 중인 데이터는 다음과 같습니다:\n\n${context}`;
        }
    }
];

// Fuse.js를 위한 평탄화 데이터 생성
let fuse = null;
function initNLP() {
    if (!window.Fuse) return; // CDN 로딩 실패 시 대비
    const fuseData = [];
    CHAT_INTENTS.forEach(intent => {
        intent.patterns.forEach(pattern => {
            fuseData.push({ text: pattern, intentId: intent.id });
        });
    });
    
    fuse = new Fuse(fuseData, {
        keys: ['text'],
        threshold: 0.6, // 오타 허용치 (0.0은 완전 일치, 1.0은 완전 불일치)
        includeScore: true
    });
}

// NLP 파싱 및 실행 (API 연결 없이 로컬에서 처리)
function processNLP(userText) {
    if (!fuse) initNLP();
    
    const context = getDashboardContext();
    
    // 1. Entity Extraction (시간 등 숫자 추출)
    let hour = null;
    const hourMatch = userText.match(/(\d+)\s*시/);
    if (hourMatch) {
        hour = parseInt(hourMatch[1]);
        if (hour > 23) hour = 23; // 상한선
    }

    // 2. Intent Classification (퍼지 검색)
    let matchedIntentId = null;
    if (fuse) {
        const results = fuse.search(userText);
        if (results.length > 0 && results[0].score <= 0.6) {
            matchedIntentId = results[0].item.intentId;
        }
    } else {
        // Fallback: Fuse가 로드되지 않았을 경우 단순 includes 검색
        for (const intent of CHAT_INTENTS) {
            if (intent.patterns.some(p => userText.includes(p.split(' ')[0]))) {
                matchedIntentId = intent.id; break;
            }
        }
    }

    // 3. Action Execution
    let responseText = "죄송합니다. 아직 해당 질문의 의도를 파악하지 못했습니다. (예: '가장 주기가 긴 교차로는?', '19시 동일주기 망 그려줘')";
    let functionToCall = null;

    if (matchedIntentId) {
        const intentObj = CHAT_INTENTS.find(i => i.id === matchedIntentId);
        if (intentObj) {
            const result = intentObj.action({ hour }, context);
            if (typeof result === 'string') {
                responseText = result;
            } else {
                responseText = result.text;
                functionToCall = result.fn;
            }
        }
    }

    return new Promise(resolve => {
        // AI가 생각하는 듯한 딜레이 부여
        setTimeout(() => {
            resolve({ text: responseText, fn: functionToCall });
        }, 500);
    });
}

// ─────────────────────────────────────────────
// 메시지 전송 핸들러
// ─────────────────────────────────────────────
function sendChatMessage() {
    const inputEl = document.getElementById('chatbot-input');
    const text = inputEl.value.trim();
    if (!text) return;
    
    addMessageToUI(text, true);
    inputEl.value = '';
    
    const msgContainer = document.getElementById('chatbot-messages');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'chatbot-loading';
    loadingDiv.style.alignSelf = 'flex-start';
    loadingDiv.style.color = '#00d4ff';
    loadingDiv.style.fontSize = '12px';
    loadingDiv.innerText = 'AI가 의도를 분석 중입니다...';
    msgContainer.appendChild(loadingDiv);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    
    // 로컬 NLP 처리 호출
    processNLP(text).then(res => {
        const ld = document.getElementById('chatbot-loading');
        if (ld) ld.remove();
        
        addMessageToUI(res.text, false);
        
        if (res.fn) {
            setTimeout(() => {
                res.fn();
                addMessageToUI("✅ **명령을 성공적으로 수행했습니다.**", false);
            }, 500);
        }
    });
}

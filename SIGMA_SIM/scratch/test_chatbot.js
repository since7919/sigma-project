const questions = [
    "종로구청 지역의 교차로 수는 몇 개야?",
    "종로경찰서 관할의 교차로 수는 몇 개야?",
    "황색시간이 4초 이상인 교차로 수는 몇 개야?",
    "전적색 시간이 1초 이상인 교차로 수는 몇 개야?",
    "좌회전 감응제어 교차로는 몇 개야?",
    "좌회전 감응제어 교차로는 어디어디야?",
    "앞막힘 예방제어 교차로는 몇 개야?",
    "좌회전 감응제어 교차로는 어디어디야?",
    "보호좌회전 교차로는 몇 개야?",
    "비보호좌회전 교차로는 몇 개야?",
    "PPLT 교차로는 몇 개야?",
    "현시수가 가장 많은 교차로는 어디야?",
    "평균 최소녹색시간이 가장 큰 교차로는 어디야?",
    "최소녹색시간 합계가 가장 큰 교차로는 어디야?",
    "종로구청 관내의 8시 평균신호주기는 몇초야?",
    "서울시 전체의 평균신호주기는 얼마야?",
    "종암경찰서 관내의 17시 평균신호주기는 몇이야?",
    "강남경찰서 관내의 연동그룹은 몇 개야?",
    "서초구에서 신호주기가 가장 높은 교차로는 어디야?",
    "금요일 일계획을 사용하는 교차로는 어디어디야?",
    "2026년 민원이 가장 많았던 교차로는 어디야?",
    "구청이 강남구인 교차로는 몇 개야",
    "경찰서가 서대문인 교차로는 몇 개야",
    "서울시 전체 평균 황색시간은 몇초야",
    "가장 많은 민원유형이 뭐야",
    "소속교차로가 가장 많은 그룹은 어디야",
    "소속교차로가 한 개인 그룹은 몇 개야",
    "안국역으로 이동",
    "가장 많이 사용되는 제어기는 뭐야",
    "보호구역이 가장 많은 구청은 어디야",
    "보호구역이 가장 많은 경찰서는 어디야",
    "평균 제한속도가 가장 낮은 구청은 어디야",
    "어린이보호구역이 가장 많은 구청은 어디야",
    "노인보호구역이 가장 많은 구청은 어디야",
    "장애인보호구역이 가장 많은 구청은 어디야",
    "은평경찰서 관내의 교차로 현황을 알려줘",
    "보행신호시간이 가장 긴 교차로는 어디야",
    "은평경찰서 관내의 평균보행신호시간은 얼마야",
    "동대문 구청 관내의 평균횡단보도 길이는 얼마야",
    "2026년 1월 25일 민원이 가장 많은 교차로는 어디야"
];

const fs = require('fs');

global.document = {
    addEventListener: () => {},
    getElementById: () => null,
    body: { insertAdjacentHTML: () => {} }
};
global.window = {};

let lastMessage = null;
global.addMessageToUI = (text, isUser) => {
    if (!isUser && !text.includes('슬롯 필링 중')) lastMessage = text;
};
global.mapHighlightResults = () => {};

let code = fs.readFileSync('js/chatbot_advanced.js', 'utf8');
code = code.replace(/function addMessageToUI[\s\S]*?\n\}/m, "function addMessageToUI(a,b){ global.addMessageToUI(a,b); }");

eval(code);

async function runTests() {
    console.log("=== STARTING TESTS ===");
    let i = 1;
    for (const q of questions) {
        lastMessage = null;
        global.STATE = { junctions: { "1": { id: "1", name: "테스트", office: "종로", police: "종로", cyc: 140, group: "A", signalMaps: [{phaseA:[1,2]}] } } };
        global.window = {};
        global.chatContext = { regions: [], regionType: 'office', logics: [] }; // Mock chatContext
        
        try {
            const res = await processAgentQuery(q);
            const msg = res.msg || lastMessage || "결과 없음";
            console.log(`Q${i}: ${q}`);
            console.log(`   -> ${msg}`);
        } catch (e) {
            console.log(`Q${i}: ${q}`);
            console.log(`   -> ERROR: ${e.message}`);
        }
        i++;
    }
}
runTests();

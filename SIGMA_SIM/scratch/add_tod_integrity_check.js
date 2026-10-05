const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const checkFuncStr = `
function checkTodMapIntegrity() {
    const errorPanel = document.getElementById('phase-error-panel');
    if (!errorPanel) return;

    const jid = STATE.activeJid;
    const j = jid ? STATE.junctions[jid] : null;
    if (!j) {
        errorPanel.style.display = 'none';
        return;
    }

    let errorMessages = [];

    // 시차맵 1~5 (SignalMaps 1~5) 검사
    for (let k = 1; k <= 5; k++) {
        const sm = j.signalMaps && j.signalMaps[k] ? j.signalMaps[k] : null;
        if (sm) {
            // 시차맵이 유효한지 검사 (시간 범위가 있고, 화살표 이동류가 하나라도 존재하는지)
            const hasTime = sm.startTime && sm.endTime && sm.startTime !== sm.endTime;
            const hasMov = (sm.movA && sm.movA.some(v => v > 0)) || (sm.movB && sm.movB.some(v => v > 0));
            
            if (hasTime && hasMov) {
                // 시차맵 k번에 대응하는 일계획은 인덱스 k+4 (Day Plan k+5)
                const dayPlanIdx = k + 4; 
                let isDayPlanEmpty = true;
                
                if (j.dayPlans && j.dayPlans[dayPlanIdx]) {
                    // 일계획 내 패턴 중 스플릿 합계가 0보다 큰 유효한 패턴이 하나라도 있는지 확인
                    for (let p = 0; p < 16; p++) {
                        const tod = j.dayPlans[dayPlanIdx][p];
                        if (tod && tod.splitA && tod.splitA.reduce((a, b) => a + b, 0) > 0) {
                            isDayPlanEmpty = false;
                            break;
                        }
                    }
                }
                
                if (isDayPlanEmpty) {
                    errorMessages.push(\`[경고] 시차맵 \${k}번(시간제 변경)이 설정되었으나, 대응하는 <b>[시간계획 \${k+5}번]</b>이 비어있습니다. 현시 불일치 오류가 발생할 수 있습니다.\`);
                }
            }
        }
    }

    if (errorMessages.length > 0) {
        errorPanel.innerHTML = errorMessages.join('<br>');
        errorPanel.style.display = 'block';
    } else {
        errorPanel.style.display = 'none';
    }
}
`;

// Insert it before updateJunctionDayUI
content = content.replace('function updateJunctionDayUI() {', checkFuncStr + '\nfunction updateJunctionDayUI() {');

// Call it inside updateJunctionDayUI
const updateFuncStr = `function updateJunctionDayUI() {
    if (typeof checkTodMapIntegrity === 'function') checkTodMapIntegrity();
    renderWeeklyPlanTable();`;
content = content.replace('function updateJunctionDayUI() {\n    renderWeeklyPlanTable();', updateFuncStr);

fs.writeFileSync('SIGMA_SIM/js/phase.js', content, 'utf8');
console.log('Added checkTodMapIntegrity to phase.js');

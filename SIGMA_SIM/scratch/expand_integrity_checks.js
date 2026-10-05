const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const targetStr = `
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

const replaceStr = `
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
    let infoMessages = [];

    // 헬퍼: 특정 일계획(Day Plan)이 완전히 비어있는지 확인
    const isDayPlanEmpty = (dayIdx) => {
        if (!j.dayPlans || !j.dayPlans[dayIdx]) return true;
        for (let p = 0; p < 16; p++) {
            const tod = j.dayPlans[dayIdx][p];
            if (tod && tod.splitA && tod.splitA.reduce((a, b) => a + b, 0) > 0) {
                return false;
            }
        }
        return true;
    };

    // 1. 시차맵 무결성 검사 (시차맵 1~5)
    for (let k = 1; k <= 5; k++) {
        const sm = j.signalMaps && j.signalMaps[k] ? j.signalMaps[k] : null;
        if (sm) {
            const hasTime = sm.startTime && sm.endTime && sm.startTime !== sm.endTime;
            const hasMov = (sm.movA && sm.movA.some(v => v > 0)) || (sm.movB && sm.movB.some(v => v > 0));
            if (hasTime && hasMov) {
                const dayPlanIdx = k + 4; // Day Plan 6~10
                if (isDayPlanEmpty(dayPlanIdx)) {
                    errorMessages.push(\`❌ <b>[경고]</b> 시차맵 \${k}번이 활성화되었으나, 대응하는 <b>[시간계획 \${k+5}번]</b>이 비어있어 현시 불일치가 발생할 수 있습니다.\`);
                }
            }
        }
    }

    // 2. 일반 일계획 우회(Fallback) 정보 및 누락 검사 (Day Plan 2~5)
    const weeklyPlanArr = (j.weeklyPlan || "1;1;1;1;1;2;3").split(';').map(v => parseInt(v) || 1);
    const requiredDayPlans = [...new Set(weeklyPlanArr)];
    
    requiredDayPlans.forEach(dayType => {
        if (dayType >= 2 && dayType <= 5) {
            const dayIdx = dayType - 1;
            if (isDayPlanEmpty(dayIdx)) {
                infoMessages.push(\`ℹ️ <b>[안내]</b> 주간계획에서 요구하는 <b>[시간계획 \${dayType}번]</b>이 비어있어, 시뮬레이션 시 <b>[시간계획 1번]</b>으로 우회 표출합니다.\`);
            }
        }
    });

    // 3. 최우선 시간계획 1번 누락 검사
    if (isDayPlanEmpty(0)) {
        errorMessages.push(\`🚨 <b>[치명적 오류]</b> 최우선 기본 플랜인 <b>[시간계획 1번]</b>이 완전히 비어있습니다. 신호가 작동하지 않습니다.\`);
    }

    // 4. 시그널맵 매핑 누락 검사 (Day Plan에 할당된 맵이 비어있는지)
    requiredDayPlans.forEach(dayType => {
        if (dayType >= 1 && dayType <= 5) {
            const dayIdx = dayType - 1;
            const mapIdx = (j.dayPlanMapIds && j.dayPlanMapIds[dayIdx] !== undefined) ? j.dayPlanMapIds[dayIdx] : 0;
            // 0번(일반맵 1번)은 보통 데이터가 있으나, 다른 맵은 없을 수 있음
            const sm = j.signalMaps && j.signalMaps[mapIdx] ? j.signalMaps[mapIdx] : null;
            if (sm && mapIdx >= 0 && mapIdx <= 4) {
                const hasMov = (sm.movA && sm.movA.some(v => v > 0)) || (sm.movB && sm.movB.some(v => v > 0));
                if (!hasMov) {
                    // 시간계획이 비어있어서 우회되는 경우면 에러를 띄울 필요 없음 (우회 로직이 처리하므로)
                    if (!isDayPlanEmpty(dayIdx)) {
                        errorMessages.push(\`⚠️ <b>[주의]</b> [시간계획 \${dayType}번]이 <b>[일반맵 \${mapIdx+1}번]</b>을 참조하고 있으나, 해당 맵의 화살표 데이터가 설정되지 않았습니다.\`);
                    }
                }
            }
        }
    });

    const allMessages = [...errorMessages, ...infoMessages];
    if (allMessages.length > 0) {
        errorPanel.innerHTML = allMessages.join('<br><div style="height:6px;"></div>');
        // 에러가 있으면 붉은색, 안내만 있으면 푸른색 테마 적용
        if (errorMessages.length > 0) {
            errorPanel.style.border = '1px solid #e74c3c';
            errorPanel.style.background = 'rgba(231, 76, 60, 0.15)';
            errorPanel.style.color = '#ff6b6b';
        } else {
            errorPanel.style.border = '1px solid #3498db';
            errorPanel.style.background = 'rgba(52, 152, 219, 0.15)';
            errorPanel.style.color = '#5dade2';
        }
        errorPanel.style.display = 'block';
    } else {
        errorPanel.style.display = 'none';
    }
}
`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('SIGMA_SIM/js/phase.js', content, 'utf8');
console.log('Replaced checkTodMapIntegrity');

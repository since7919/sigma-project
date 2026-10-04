const fs = require('fs');

let utilsJs = fs.readFileSync('SIGMA_SIM/js/utils.js', 'utf8');

const helperFunctions = `
/**
 * ----------------------------------------------------
 * DAY PLAN FALLBACK LOGIC
 * ----------------------------------------------------
 * 실무 규격에 따라, Day Plan 2~5(주말/특수일)가 지정되었으나
 * 비어있거나(splitA 합산 0) 오류가 있는 경우, 자동으로 최우선 기본값인
 * 1번 일계획(Day Plan 1)으로 우회(Fallback)하여 운영합니다.
 */
function getEffectiveDayPlan(j, dayIdx, pIdx) {
    if (!j || !j.dayPlans) return null;
    let tod = j.dayPlans[dayIdx] ? j.dayPlans[dayIdx][pIdx] : null;
    
    // 빈 플랜인지 검사 (splitA 합산 0)
    const isEmpty = !tod || !tod.splitA || tod.splitA.reduce((a, b) => a + b, 0) === 0;
    
    // 빈 플랜이면 무조건 1번 플랜(인덱스 0)으로 강제 우회
    if (dayIdx > 0 && isEmpty) {
        tod = j.dayPlans[0] ? j.dayPlans[0][pIdx] : null;
    }
    return tod;
}

function getEffectiveSignalMapIdx(j, dayIdx, pIdx) {
    if (!j || !j.dayPlans) return 0;
    let tod = j.dayPlans[dayIdx] ? j.dayPlans[dayIdx][pIdx] : null;
    const isEmpty = !tod || !tod.splitA || tod.splitA.reduce((a, b) => a + b, 0) === 0;
    
    // 만약 플랜이 비어서 1번 플랜으로 우회했다면, 맵핑(Signal Map)도 1번 플랜의 것을 참조해야 함
    let effDayIdx = (dayIdx > 0 && isEmpty) ? 0 : dayIdx;
    
    return (j.dayPlanMapIds && j.dayPlanMapIds[effDayIdx] !== undefined) ? j.dayPlanMapIds[effDayIdx] : 0;
}

function getEffectiveSignalMap(j, dayIdx, pIdx) {
    if (!j || !j.signalMaps) return null;
    const smIdx = getEffectiveSignalMapIdx(j, dayIdx, pIdx);
    return j.signalMaps[smIdx] || null;
}
`;

if (!utilsJs.includes('getEffectiveDayPlan')) {
    utilsJs = utilsJs + '\n' + helperFunctions;
    fs.writeFileSync('SIGMA_SIM/js/utils.js', utilsJs, 'utf8');
    console.log('Added fallback helpers to utils.js');
}

const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/utils.js', 'utf8');

const targetStr = `
    // 5. 현재 시뮬레이션 시간(t)에 맞는 TOD 플랜(pIdx) 찾기
    let activePIdx = 0;
    if (j.schedules && j.schedules[useDayIdx]) {
        const scheds = j.schedules[useDayIdx];
        const tMins = Math.floor(t / 60);
        let lastValidPIdx = 0;
        for (let i = 0; i < 16; i++) {
            const sc = scheds[i];
            if (!sc || sc.h === -1) break;
            const scMins = sc.h * 60 + sc.m;
            if (tMins >= scMins) {
                lastValidPIdx = i;
            } else {
                break;
            }
        }
        activePIdx = lastValidPIdx;
    }

    return { dayIdx: useDayIdx, mapIdx: activeSignalMapIdx, pIdx: activePIdx };
}
`;

const replaceStr = `
    // 5. 현재 시뮬레이션 시간(t)에 맞는 TOD 플랜(pIdx) 찾기
    let activePIdx = 0;
    if (j.schedules && j.schedules[useDayIdx]) {
        const scheds = j.schedules[useDayIdx];
        const tMins = Math.floor(t / 60);
        let lastValidPIdx = 0;
        for (let i = 0; i < 16; i++) {
            const sc = scheds[i];
            if (!sc || sc.h === -1) break;
            const scMins = sc.h * 60 + sc.m;
            if (tMins >= scMins) {
                lastValidPIdx = i;
            } else {
                break;
            }
        }
        activePIdx = lastValidPIdx;
    }

    // 6. [중요] 해당 플랜이 비어있는지 확인하여 1번 플랜으로 우회(Fallback) 처리
    let effDayIdx = useDayIdx;
    if (useDayIdx > 0 && j.dayPlans) {
        let tod = j.dayPlans[useDayIdx] ? j.dayPlans[useDayIdx][activePIdx] : null;
        const isEmpty = !tod || !tod.splitA || tod.splitA.reduce((a, b) => a + b, 0) === 0;
        if (isEmpty) {
            effDayIdx = 0; // 1번 플랜으로 우회
        }
    }

    // 7. 우회된 일계획(effDayIdx)에 맞는 기본 시그널맵 인덱스로 다시 갱신
    if (timedMapIdx === 0) { // 시차맵(Override)이 활성화되지 않은 경우에만
        activeSignalMapIdx = (j.dayPlanMapIds && j.dayPlanMapIds[effDayIdx] !== undefined) ? j.dayPlanMapIds[effDayIdx] : 0;
    }

    return { dayIdx: useDayIdx, mapIdx: activeSignalMapIdx, pIdx: activePIdx, effDayIdx: effDayIdx };
}
`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync('SIGMA_SIM/js/utils.js', content, 'utf8');
console.log('Fixed getSimContext fallback logic');

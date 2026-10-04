const fs = require('fs');

let dataJs = fs.readFileSync('SIGMA_SIM/js/data.js', 'utf8');

const regex = /\/\/ 헬퍼: 통계 계산\nfunction calculateStats\(inters\) \{[\s\S]*?\}\n?\}/;

const newCalculateStats = `// 헬퍼: 통계 계산 (고도화된 TOD 및 보행자 데이터 포함)
function calculateStats(inters) {
    if (!inters || inters.length === 0) return { total_intersections: 0 };
    
    let cycles = { ALL: [], AM_PEAK: [], PM_PEAK: [], NORMAL: [], NIGHT: [] };
    let coordCount = 0;
    let pplt = 0, diag = 0, pLeft = 0;
    
    // 보행자 관련 지표
    let totalPedWait = 0, pedWaitCount = 0;

    inters.forEach(j => {
        if (!j.dayPlans || !j.schedules) return;
        
        // 1. 교차로 레벨 고정 특성 (대각선, PPLT 등)
        if (j.isPPLT) pplt++;
        if (j.isDiag) diag++;
        if (j.isPLeft) pLeft++;

        const scheds = j.schedules[0] || [];
        const plans = j.dayPlans[0] || [];

        // 2. 시간대별(TOD) 분석
        scheds.forEach(sched => {
            if (!sched || sched.h < 0) return;
            const h = sched.h;
            const tpIdx = sched.sIdx !== undefined ? sched.sIdx : ((sched.idx || 1) - 1);
            const plan = plans[tpIdx];
            
            if (plan && plan.cycle > 0) {
                const c = plan.cycle;
                cycles.ALL.push(c);
                
                // 시간대 분류
                if (h >= 7 && h <= 9) cycles.AM_PEAK.push(c);
                else if (h >= 17 && h <= 19) cycles.PM_PEAK.push(c);
                else if (h >= 22 || h <= 5) cycles.NIGHT.push(c);
                else cycles.NORMAL.push(c);
                
                // 보행자 대기시간 추정 (단순화: 주기 - 주도로 보행녹색시간(통상 직진과 연동))
                // 데이터에 명시적인 보행현시 배열이 없다면 주기의 70%를 대기시간으로 러프하게 추정하거나,
                // splitA[0] (보통 1현시 주방향 직진)을 기준으로 계산합니다.
                const mainGreen = plan.splitA && plan.splitA[0] ? plan.splitA[0] : (c * 0.3);
                const pedWait = c - mainGreen; // 횡단보도 적색시간(대기시간)
                if (pedWait > 0) {
                    totalPedWait += pedWait;
                    pedWaitCount++;
                }
            }
        });
        
        // 연동 교차로 여부 (Plan 1 기준)
        if (plans[0] && plans[0].offset > 0) coordCount++;
    });
    
    const getAvg = (arr) => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : "0.0";
    const getMax = (arr) => arr.length ? Math.max(...arr) : 0;
    const getMin = (arr) => arr.length ? Math.min(...arr) : 0;

    return {
        총_교차로수: inters.length,
        연동_교차로수: coordCount,
        연동화율: ((coordCount / inters.length) * 100).toFixed(1) + '%',
        신호주기_통계: {
            전체_평균주기: parseFloat(getAvg(cycles.ALL)),
            최대주기_Max: getMax(cycles.ALL),
            최소주기_Min: getMin(cycles.ALL),
            시간대별_평균주기: {
                오전첨두_AM_PEAK: parseFloat(getAvg(cycles.AM_PEAK)),
                낮시간_NORMAL: parseFloat(getAvg(cycles.NORMAL)),
                오후첨두_PM_PEAK: parseFloat(getAvg(cycles.PM_PEAK)),
                심야시간_NIGHT: parseFloat(getAvg(cycles.NIGHT))
            }
        },
        현시_및_보행신호_특성: {
            보호좌회전_교차로: pLeft,
            비보호좌회전겸용_PPLT: pplt,
            대각선_횡단보도_운영: diag,
            평균_보행자_대기시간_추정: pedWaitCount ? parseFloat((totalPedWait / pedWaitCount).toFixed(1)) : 0
        }
    };
}`;

if (dataJs.match(regex)) {
    dataJs = dataJs.replace(regex, newCalculateStats);
    fs.writeFileSync('SIGMA_SIM/js/data.js', dataJs, 'utf8');
    console.log('calculateStats upgraded in data.js');
} else {
    console.log('Regex failed to match calculateStats');
}

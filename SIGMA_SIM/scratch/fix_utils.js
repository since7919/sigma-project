const fs = require('fs');

let js = fs.readFileSync('../js/utils.js', 'utf8');

const oldFunc = `function findActiveSchedIdx(sched, timeSec) {
    let activeIdx = 0, maxSec = -1;
    sched.forEach((sc, idx) => {
        if (sc && sc.h !== -1) {
            const total = sc.h * 3600 + sc.m * 60;
            if (timeSec >= total && total > maxSec) {
                maxSec = total;
                activeIdx = idx;
            }
        }
    });
    return activeIdx;
}`;

const newFunc = `function findActiveSchedIdx(sched, timeSec) {
    if (!sched || sched.length === 0) return 0;
    let activeIdx = -1, maxSec = -1;
    let lastValidIdx = -1;
    sched.forEach((sc, idx) => {
        if (sc && sc.h !== -1) {
            lastValidIdx = idx;
            const total = sc.h * 3600 + (sc.m || 0) * 60;
            if (timeSec >= total && total > maxSec) {
                maxSec = total;
                activeIdx = idx;
            }
        }
    });
    if (activeIdx === -1) {
        activeIdx = lastValidIdx !== -1 ? lastValidIdx : 0;
    }
    return activeIdx;
}`;

js = js.replace(oldFunc, newFunc);
fs.writeFileSync('../js/utils.js', js);
console.log('Fixed findActiveSchedIdx in utils.js');

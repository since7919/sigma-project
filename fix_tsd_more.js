const fs = require('fs');

function applyFallbackAll(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');

    // Replace: const plan = j.dayPlans[dayIdx][pIdx];
    code = code.replace(
        'const plan = j.dayPlans[dayIdx][pIdx];',
        'const plan = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : j.dayPlans[dayIdx][pIdx];'
    );

    // Replace: const curOffset = (j.dayPlans && j.dayPlans[dayIdx] && j.dayPlans[dayIdx][pIdx]) ? (j.dayPlans[dayIdx][pIdx].offset || 0) : 0;
    code = code.replace(
        'const curOffset = (j.dayPlans && j.dayPlans[dayIdx] && j.dayPlans[dayIdx][pIdx]) ? (j.dayPlans[dayIdx][pIdx].offset || 0) : 0;',
        'const _effPlan = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : (j.dayPlans && j.dayPlans[dayIdx] ? j.dayPlans[dayIdx][pIdx] : null);\n            const curOffset = _effPlan ? (_effPlan.offset || 0) : 0;'
    );

    fs.writeFileSync(filePath, code, 'utf8');
}

applyFallbackAll('SIGMA_SIM/js/tsd.js');
console.log('Fixed more usages in tsd.js');

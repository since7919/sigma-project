const fs = require('fs');

let code = fs.readFileSync('SIGMA_SIM/js/stats.js', 'utf8');

code = code.replace(
    'const plan = (j.dayPlans && j.dayPlans[primaryDayIdx]) ? j.dayPlans[primaryDayIdx][pIdx] : null;',
    'const plan = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, primaryDayIdx, pIdx) : ((j.dayPlans && j.dayPlans[primaryDayIdx]) ? j.dayPlans[primaryDayIdx][pIdx] : null);'
);

code = code.replace(
    'const activeDPlan = j.dayPlans && j.dayPlans[0] && j.dayPlans[0][tpIdx] ? j.dayPlans[0][tpIdx] : null;',
    'const activeDPlan = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, 0, tpIdx) : (j.dayPlans && j.dayPlans[0] && j.dayPlans[0][tpIdx] ? j.dayPlans[0][tpIdx] : null);'
);

fs.writeFileSync('SIGMA_SIM/js/stats.js', code, 'utf8');
console.log('Fixed stats.js');

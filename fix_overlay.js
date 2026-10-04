const fs = require('fs');

let code = fs.readFileSync('SIGMA_SIM/js/overlay_ui.js', 'utf8');

code = code.replace(
    'const plan = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;',
    'const plan = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : ((j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null);'
);

code = code.replace(
    'const p = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][rIdx] : null;',
    'const p = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, rIdx) : ((j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][rIdx] : null);'
);

fs.writeFileSync('SIGMA_SIM/js/overlay_ui.js', code, 'utf8');
console.log('Fixed overlay_ui.js');

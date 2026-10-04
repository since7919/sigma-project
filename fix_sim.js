const fs = require('fs');

let code = fs.readFileSync('SIGMA_SIM/js/simulation.js', 'utf8');

code = code.replace(
    'const targetP = (j.dayPlans && j.dayPlans[useDayIdx]) ? j.dayPlans[useDayIdx][currentPlanIdx] : null;',
    'const targetP = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, useDayIdx, currentPlanIdx) : ((j.dayPlans && j.dayPlans[useDayIdx]) ? j.dayPlans[useDayIdx][currentPlanIdx] : null);'
);

fs.writeFileSync('SIGMA_SIM/js/simulation.js', code, 'utf8');
console.log('Fixed simulation.js');

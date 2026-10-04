const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const regex = /function renderTodPlanInfoTable\(\) \{[\s\S]*?const pIdx = parseInt\(UI\.planIdx\?\.value\) \|\| 0;/;

c = c.replace(regex, (match) => {
    return match + '\n    const currentSlot = STATE.currentTodSlotIdx !== undefined ? STATE.currentTodSlotIdx : pIdx;';
});

fs.writeFileSync('SIGMA_SIM/js/phase.js', c, 'utf8');

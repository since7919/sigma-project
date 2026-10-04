const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

c = c.replace(
    'const pIdx = parseInt(UI.planIdx?.value) || 0;',
    'const pIdx = parseInt(UI.planIdx?.value) || 0;\n    const currentSlot = STATE.currentTodSlotIdx !== undefined ? STATE.currentTodSlotIdx : pIdx;'
);

c = c.replace(
    'const isActive = (dayIdx === idx && pIdx === rIdx && sc && sc.h !== -1);',
    'const isActive = (dayIdx === idx && currentSlot === rIdx && sc && sc.h !== -1);'
);

const newSelectCell = `window.selectTodPlanCell = function(dayIdx, slotIdx) {
    let targetPlanIdx = slotIdx;
    if (STATE.activeJid && STATE.junctions[STATE.activeJid]) {
        const j = STATE.junctions[STATE.activeJid];
        if (j.schedules && j.schedules[dayIdx] && j.schedules[dayIdx][slotIdx]) {
            const sch = j.schedules[dayIdx][slotIdx];
            if (sch.h !== -1 && sch.idx > 0 && sch.idx <= 16) {
                targetPlanIdx = sch.idx - 1;
            }
        }
    }
    
    if (STATE.currentJunctionDayTypeIdx === dayIdx && STATE.currentTodSlotIdx === slotIdx && parseInt(UI.planIdx.value || 0) === targetPlanIdx) {
        return;
    }

    let activeDay = null, activeSlot = null, activeField = null;
    if (document.activeElement && document.activeElement.hasAttribute('data-day')) {
        activeDay = document.activeElement.getAttribute('data-day');
        activeSlot = document.activeElement.getAttribute('data-slot');
        activeField = document.activeElement.getAttribute('data-field');
    }
    STATE.currentJunctionDayTypeIdx = dayIdx;
    STATE.currentTodSlotIdx = slotIdx;
    UI.planIdx.value = targetPlanIdx;`;

const regexSelect = /window\.selectTodPlanCell = function\(dayIdx, slotIdx\) \{[\s\S]*?UI\.planIdx\.value = slotIdx;/;
c = c.replace(regexSelect, newSelectCell);

fs.writeFileSync('SIGMA_SIM/js/phase.js', c, 'utf8');

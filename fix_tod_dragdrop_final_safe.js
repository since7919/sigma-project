const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// 1. Change dataTransfer type
p = p.replace(
    "e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'phase-tod', dayIdx, slotIdx }));",
    "e.dataTransfer.setData('application/x-sigma-tod', JSON.stringify({ type: 'phase-tod', dayIdx, slotIdx }));"
);

// 2. Fix the drop handler
const anchor1 = "const data = JSON.parse(e.dataTransfer.getData('text/plain'));";
const anchor2 = "} catch (err) {}";

let start = p.indexOf("try {\\n", p.indexOf(anchor1) - 50);
if (start === -1) start = p.indexOf("try {\\r\\n", p.indexOf(anchor1) - 50);
if (start === -1) start = p.indexOf("try {", p.indexOf(anchor1) - 50);

let end = p.indexOf(anchor2, start);

if (start !== -1 && end !== -1) {
    const before = p.substring(0, start);
    const after = p.substring(end + anchor2.length);
    
    const newTryCatch = `try {
                const rawData = e.dataTransfer.getData('application/x-sigma-tod') || e.dataTransfer.getData('text/plain');
                if (!rawData) return;
                
                const data = JSON.parse(rawData);
                if (data.type === 'phase-tod') {
                    const srcDay = data.dayIdx;
                    const srcSlot = data.slotIdx;
                    const tgtDay = parseInt(td.dataset.dropDay);
                    const tgtSlot = parseInt(td.dataset.dropSlot);
                    
                    if (srcDay === tgtDay && srcSlot === tgtSlot) return;
                    
                    const jid = window.STATE ? window.STATE.activeJid : (typeof STATE !== 'undefined' ? STATE.activeJid : null);
                    const j = window.STATE ? window.STATE.junctions[jid] : (typeof STATE !== 'undefined' ? STATE.junctions[jid] : null);
                    if (!j || !j.schedules) return;
                    
                    if (!j.schedules[tgtDay]) j.schedules[tgtDay] = [];
                    if (!j.schedules[srcDay] || !j.schedules[srcDay][srcSlot]) return;
                    
                    j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    
                    for(let i=0; i<tgtSlot; i++) {
                        if (!j.schedules[tgtDay][i]) j.schedules[tgtDay][i] = { h: -1, cycle: 0 };
                    }
                    
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    if (typeof renderSummaryTable === 'function') renderSummaryTable();
                    if (typeof debounceUpdateHeavyUI === 'function') debounceUpdateHeavyUI();
                    if (tgtDay === (window.STATE ? window.STATE.currentJunctionDayTypeIdx : STATE.currentJunctionDayTypeIdx) && tgtSlot === parseInt(UI.planIdx.value)) {
                        if (typeof renderRingTables === 'function') renderRingTables();
                    }
                }
            } catch (err) {
                console.error("Drop Parse Error", err);
            }`;
            
    fs.writeFileSync('SIGMA_SIM/js/phase.js', before + newTryCatch + after, 'utf8');
    console.log("REPLACED DROP HANDLER SAFELY");
} else {
    console.log("FAILED to find bounds:", start, end);
}

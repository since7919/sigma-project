const fs = require('fs');

let phaseJs = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// 1. Change drag start mime type
phaseJs = phaseJs.replace(
    "e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'phase-tod', dayIdx, slotIdx }));",
    "e.dataTransfer.setData('application/x-sigma-tod', JSON.stringify({ type: 'phase-tod', dayIdx, slotIdx }));"
);

// 2. Safely replace the exact try-catch block
const oldTryCatch = `            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.type === 'phase-tod') {
                    const srcDay = data.dayIdx;
                    const srcSlot = data.slotIdx;
                    const tgtDay = parseInt(td.dataset.dropDay);
                    const tgtSlot = parseInt(td.dataset.dropSlot);
                    
                    if (srcDay === tgtDay && srcSlot === tgtSlot) return;
                    
                    const jid = STATE.activeJid;
                    const j = STATE.junctions[jid];
                    if (!j || !j.schedules) return;
                    
                    // Copy schedule
                    j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    
                    // Re-render
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    renderSummaryTable();
                    debounceUpdateHeavyUI();
                    if (tgtDay === STATE.currentJunctionDayTypeIdx && tgtSlot === parseInt(UI.planIdx.value)) {
                        if (typeof renderRingTables === 'function') renderRingTables();
                    }
                }
            } catch (err) {}`;

const newTryCatch = `            try {
                // 커스텀 마임타입을 사용하여 브라우저 자동 텍스트 삽입 방지
                const rawData = e.dataTransfer.getData('application/x-sigma-tod') || e.dataTransfer.getData('text/plain');
                if (!rawData) return;
                
                const data = JSON.parse(rawData);
                if (data.type === 'phase-tod') {
                    const srcDay = data.dayIdx;
                    const srcSlot = data.slotIdx;
                    const tgtDay = parseInt(td.dataset.dropDay);
                    const tgtSlot = parseInt(td.dataset.dropSlot);
                    
                    if (srcDay === tgtDay && srcSlot === tgtSlot) return;
                    
                    const jid = STATE.activeJid;
                    const j = STATE.junctions[jid];
                    if (!j || !j.schedules) return;
                    
                    // 안전한 배열 초기화
                    if (!j.schedules[tgtDay]) j.schedules[tgtDay] = [];
                    if (!j.schedules[srcDay] || !j.schedules[srcDay][srcSlot]) return;
                    
                    // Copy schedule
                    j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    
                    // 앞의 빈 슬롯 채우기
                    for(let i=0; i<tgtSlot; i++) {
                        if (!j.schedules[tgtDay][i]) j.schedules[tgtDay][i] = { h: -1, cycle: 0 };
                    }
                    
                    // Re-render
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    renderSummaryTable();
                    debounceUpdateHeavyUI();
                    if (tgtDay === STATE.currentJunctionDayTypeIdx && tgtSlot === parseInt(UI.planIdx.value)) {
                        if (typeof renderRingTables === 'function') renderRingTables();
                    }
                }
            } catch (err) {
                console.error("Drop Parse Error", err);
            }`;

if (phaseJs.includes(oldTryCatch)) {
    phaseJs = phaseJs.replace(oldTryCatch, newTryCatch);
    fs.writeFileSync('SIGMA_SIM/js/phase.js', phaseJs, 'utf8');
    console.log("SUCCESS");
} else {
    console.log("FAILED to find exactly the old try catch block");
}

const fs = require('fs');
let lines = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8').split('\\n');

let start = -1;
let end = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("const data = JSON.parse(e.dataTransfer.getData('text/plain'));")) {
        start = i - 1; // get the 'try {'
    }
    if (start !== -1 && lines[i].includes('} catch (err) {}')) {
        end = i;
        break;
    }
}

if (start !== -1 && end !== -1) {
    const newDrop = `            try {
                // Prevent browser text paste by using custom mime type
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
                    
                    // 빈 배열 안전하게 초기화
                    if (!j.schedules[tgtDay]) j.schedules[tgtDay] = [];
                    if (!j.schedules[srcDay] || !j.schedules[srcDay][srcSlot]) return;
                    
                    // Copy schedule
                    j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    
                    // 앞의 빈 슬롯 채우기
                    for(let i=0; i<tgtSlot; i++) {
                        if (!j.schedules[tgtDay][i]) j.schedules[tgtDay][i] = { h: -1, cycle: 0, idx: 1 };
                    }
                    
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    if (typeof renderSummaryTable === 'function') renderSummaryTable();
                    if (typeof debounceUpdateHeavyUI === 'function') debounceUpdateHeavyUI();
                    
                    j._isDirty = true;
                    if (typeof updateDBButtonState === 'function') updateDBButtonState();
                }
            } catch(err) {
                console.error('Drop Error:', err);
            }`;
    
    lines.splice(start, end - start + 1, newDrop);
    fs.writeFileSync('SIGMA_SIM/js/phase.js', lines.join('\\n'), 'utf8');
    console.log('Drop logic replaced!');
} else {
    console.log('Could not find bounds.', start, end);
}

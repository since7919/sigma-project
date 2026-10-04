const fs = require('fs');

let phaseJs = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const regex = /try\s*\{\s*const data = JSON\.parse\(e\.dataTransfer\.getData\('text\/plain'\)\);[\s\S]*?\}\s*catch\(err\)\s*\{\s*\}/;

const newDrop = `try {
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
                    if (!j.schedules[srcDay] || !j.schedules[srcDay][srcSlot]) return; // 원본 체크
                    
                    // 덮어쓰기
                    j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    
                    // 앞의 빈 슬롯 채우기
                    for(let i=0; i<tgtSlot; i++) {
                        if (!j.schedules[tgtDay][i]) j.schedules[tgtDay][i] = { h: -1, cycle: 0 };
                    }
                    
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    if (typeof renderSummaryTable === 'function') renderSummaryTable();
                    if (typeof debounceUpdateHeavyUI === 'function') debounceUpdateHeavyUI();
                    
                    j._isDirty = true;
                    if (typeof updateDBButtonState === 'function') updateDBButtonState();
                }
            } catch(err) {
                console.error('Drop error:', err);
            }`;

if (phaseJs.match(regex)) {
    phaseJs = phaseJs.replace(regex, newDrop);
    fs.writeFileSync('SIGMA_SIM/js/phase.js', phaseJs, 'utf8');
    console.log('Successfully replaced drop logic.');
} else {
    console.log('Could not match try/catch block.');
}

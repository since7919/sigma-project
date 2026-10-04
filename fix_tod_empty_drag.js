const fs = require('fs');
let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const s1 = p.indexOf('const data = window.__DRAG_TOD;');
const s2 = p.indexOf('} catch (err) {', s1);

if (s1 !== -1 && s2 !== -1) {
    const before = p.substring(0, s1);
    const after = p.substring(s2);
    
    const mid = `const data = window.__DRAG_TOD;
                if (!data) return;
                
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
                    
                    // 빈 셀을 드래그하면 타겟 셀도 초기화
                    if (!j.schedules[srcDay] || !j.schedules[srcDay][srcSlot]) {
                        j.schedules[tgtDay][tgtSlot] = { h: -1, cycle: 0 };
                    } else {
                        j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    }
                    
                    // 빈 슬롯 채우기
                    for(let i=0; i<tgtSlot; i++) {
                        if (!j.schedules[tgtDay][i]) j.schedules[tgtDay][i] = { h: -1, cycle: 0 };
                    }
                    
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    if (typeof renderSummaryTable === 'function') renderSummaryTable();
                    if (typeof debounceUpdateHeavyUI === 'function') debounceUpdateHeavyUI();
                    
                    if (tgtDay === (window.STATE ? window.STATE.currentJunctionDayTypeIdx : STATE.currentJunctionDayTypeIdx) && tgtSlot === parseInt(UI.planIdx.value)) {
                        if (typeof renderRingTables === 'function') renderRingTables();
                    }
                    
                    j._isDirty = true;
                    if (typeof updateDBButtonState === 'function') updateDBButtonState();
                    
                    window.__DRAG_TOD = null;
                }
            `;
    fs.writeFileSync('SIGMA_SIM/js/phase.js', before + mid + after, 'utf8');
    console.log("REPLACED DROP LOGIC WITH CLEAR FUNCTIONALITY");
} else {
    console.log("Failed to find boundaries");
}

const fs = require('fs');
let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const s1 = p.indexOf("const data = window.__DRAG_TOD;");
const s2 = p.indexOf("console.error(\"Drop Parse Error\", err);");

if (s1 !== -1 && s2 !== -1) {
    const before = p.substring(0, s1);
    const after = p.substring(s2 + "console.error(\"Drop Parse Error\", err);".length);
    
    const mid = `const data = window.__DRAG_TOD;
                if (!data) {
                    alert("드래그 데이터가 없습니다. 브라우저가 이벤트를 차단했습니다.");
                    return;
                }
                
                if (data.type === 'phase-tod') {
                    const srcDay = data.dayIdx;
                    const srcSlot = data.slotIdx;
                    const tgtDay = parseInt(td.dataset.dropDay);
                    const tgtSlot = parseInt(td.dataset.dropSlot);
                    
                    if (srcDay === tgtDay && srcSlot === tgtSlot) return;
                    
                    const jid = window.STATE ? window.STATE.activeJid : (typeof STATE !== 'undefined' ? STATE.activeJid : null);
                    const j = window.STATE ? window.STATE.junctions[jid] : (typeof STATE !== 'undefined' ? STATE.junctions[jid] : null);
                    if (!j || !j.schedules) {
                        alert("교차로 데이터가 없습니다.");
                        return;
                    }
                    
                    if (!j.schedules[tgtDay]) j.schedules[tgtDay] = [];
                    
                    if (!j.schedules[srcDay] || !j.schedules[srcDay][srcSlot]) {
                        j.schedules[tgtDay][tgtSlot] = { h: -1, cycle: 0 };
                    } else {
                        j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    }
                    
                    for(let i=0; i<tgtSlot; i++) {
                        if (!j.schedules[tgtDay][i]) j.schedules[tgtDay][i] = { h: -1, cycle: 0 };
                    }
                    
                    try {
                        if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                        if (typeof renderSummaryTable === 'function') renderSummaryTable();
                        if (typeof debounceUpdateHeavyUI === 'function') debounceUpdateHeavyUI();
                    } catch(rErr) {
                        alert("렌더링 에러: " + rErr.message);
                    }
                    
                    try {
                        const activeDayIdx = window.STATE ? window.STATE.currentJunctionDayTypeIdx : (typeof STATE !== 'undefined' ? STATE.currentJunctionDayTypeIdx : -1);
                        const pIdxVal = (typeof UI !== 'undefined' && UI.planIdx) ? parseInt(UI.planIdx.value) : -1;
                        if (tgtDay === activeDayIdx && tgtSlot === pIdxVal) {
                            if (typeof renderRingTables === 'function') renderRingTables();
                        }
                    } catch(pErr) {
                        alert("UI 상태 에러: " + pErr.message);
                    }
                    
                    j._isDirty = true;
                    if (typeof updateDBButtonState === 'function') updateDBButtonState();
                    
                    window.__DRAG_TOD = null;
                    
                    // 성공 알림 (디버깅용)
                    // alert("성공적으로 복사했습니다!");
                }
            } catch (err) {
                alert("드롭 에러 발생: " + err.message + "\\n" + err.stack);
                console.error("Drop Parse Error", err);`;
    
    fs.writeFileSync('SIGMA_SIM/js/phase.js', before + mid + after, 'utf8');
    console.log("INJECTED ALERTS");
} else {
    console.log("FAILED TO FIND MARKERS");
}

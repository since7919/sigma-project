const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// 1. Rewrite handlePhaseTodDragStart to use a global variable
const dragStartRegex = /window\.handlePhaseTodDragStart\s*=\s*function\(e,\s*dayIdx,\s*slotIdx\)\s*\{[\s\S]*?e\.dataTransfer\.effectAllowed\s*=\s*'copyMove';/;
const newDragStart = `window.handlePhaseTodDragStart = function(e, dayIdx, slotIdx) {
    // 글로벌 변수에 드래그 데이터 저장 (브라우저 MIME 정책 우회)
    window.__DRAG_TOD = { type: 'phase-tod', dayIdx, slotIdx };
    // 텍스트는 브라우저가 input에 자동 붙여넣기 하지 않도록 아주 짧은 공백 문자 하나만 전달
    e.dataTransfer.setData('text/plain', ' ');
    e.dataTransfer.effectAllowed = 'copyMove';`;

if (p.match(dragStartRegex)) {
    p = p.replace(dragStartRegex, newDragStart);
}

// 2. Rewrite the drop handler to read from the global variable
const anchor1 = "const rawData = e.dataTransfer.getData('application/x-sigma-tod') || e.dataTransfer.getData('text/plain');";
const anchor2 = "} catch (err) {";

let start = p.indexOf("try {", p.indexOf(anchor1) - 50);
let end = p.indexOf(anchor2, start);

if (start !== -1 && end !== -1) {
    const before = p.substring(0, start);
    const after = p.substring(end + anchor2.length);
    
    const newTryCatch = `try {
                // 커스텀 마임타입 대신, 드래그 시 저장한 글로벌 변수에서 데이터 읽기
                const data = window.__DRAG_TOD;
                if (!data) return;
                
                // 공백 문자가 input에 들어갔을 수 있으므로 강제 blur 및 값 초기화 유도 (안해도 Re-render 되면서 사라짐)
                
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
                        if (!j.schedules[tgtDay][i]) j.schedules[tgtDay][i] = { h: -1, cycle: 0, idx: 1 };
                    }
                    
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    if (typeof renderSummaryTable === 'function') renderSummaryTable();
                    if (typeof debounceUpdateHeavyUI === 'function') debounceUpdateHeavyUI();
                    
                    if (tgtDay === (window.STATE ? window.STATE.currentJunctionDayTypeIdx : STATE.currentJunctionDayTypeIdx) && tgtSlot === parseInt(UI.planIdx.value)) {
                        if (typeof renderRingTables === 'function') renderRingTables();
                    }
                    
                    j._isDirty = true;
                    if (typeof updateDBButtonState === 'function') updateDBButtonState();
                    
                    window.__DRAG_TOD = null; // 드롭 후 데이터 초기화
                }
            } catch (err) {`;
            
    fs.writeFileSync('SIGMA_SIM/js/phase.js', before + newTryCatch + after, 'utf8');
    console.log("REPLACED GLOBALS");
} else {
    console.log("Failed", start, end);
}

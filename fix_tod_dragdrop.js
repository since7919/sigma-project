const fs = require('fs');

let phaseJs = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// 1. Change dataTransfer type to prevent automatic text pasting into inputs
// Find handlePhaseTodDragStart
const dragStartOld = `window.handlePhaseTodDragStart = function(event, dayIdx, slotIdx) {
    const data = { type: 'phase-tod', dayIdx, slotIdx };
    event.dataTransfer.setData('text/plain', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'copy';
};`;

const dragStartNew = `window.handlePhaseTodDragStart = function(event, dayIdx, slotIdx) {
    const data = { type: 'phase-tod', dayIdx, slotIdx };
    // 브라우저가 input 창에 텍스트를 자동 붙여넣기 하지 못하도록 커스텀 타입 사용
    event.dataTransfer.setData('application/x-sigma-tod', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'copy';
};`;

if (phaseJs.includes(dragStartOld)) {
    phaseJs = phaseJs.replace(dragStartOld, dragStartNew);
} else {
    // try a more fuzzy replace
    phaseJs = phaseJs.replace(/event\.dataTransfer\.setData\('text\/plain', JSON\.stringify\(data\)\);/g, "event.dataTransfer.setData('application/x-sigma-tod', JSON.stringify(data));");
}

// 2. Fix the drop handler to safely create nested arrays and use the new mime type
const dropLogicOld = `            try {
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
                    
                    // Trigger DB save state
                    j._isDirty = true;
                    if (typeof updateDBButtonState === 'function') updateDBButtonState();
                }
            } catch(err) {
                // Ignore parse errors from other drops
            }`;

const dropLogicNew = `            try {
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
                    
                    // 안전한 복사를 위해 타겟 배열이 없으면 생성
                    if (!j.schedules[tgtDay]) j.schedules[tgtDay] = [];
                    if (!j.schedules[srcDay] || !j.schedules[srcDay][srcSlot]) return; // 원본이 없으면 취소
                    
                    // Copy schedule
                    j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    
                    // 빈 공간 채우기 (앞쪽 인덱스가 비어있으면 빈 객체로)
                    for(let i=0; i<tgtSlot; i++) {
                        if (!j.schedules[tgtDay][i]) j.schedules[tgtDay][i] = { h: -1, cycle: 0 };
                    }
                    
                    // Re-render
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    if (typeof renderSummaryTable === 'function') renderSummaryTable();
                    
                    // Trigger DB save state
                    j._isDirty = true;
                    if (typeof updateDBButtonState === 'function') updateDBButtonState();
                }
            } catch(err) {
                console.error("TOD Drop Error:", err);
            }`;

if (phaseJs.includes(dropLogicOld)) {
    phaseJs = phaseJs.replace(dropLogicOld, dropLogicNew);
    fs.writeFileSync('SIGMA_SIM/js/phase.js', phaseJs, 'utf8');
    console.log('Drag and Drop logic perfectly repaired.');
} else {
    // If exact match fails, let's try to just replace the logic inside the drop event
    const fallbackStart = "const data = JSON.parse(e.dataTransfer.getData('text/plain'));";
    if (phaseJs.includes(fallbackStart)) {
        phaseJs = phaseJs.replace(/const data = JSON\.parse\(e\.dataTransfer\.getData\('text\/plain'\)\);[\s\S]*?catch\(err\) \{[\s\S]*?\}/, dropLogicNew);
        fs.writeFileSync('SIGMA_SIM/js/phase.js', phaseJs, 'utf8');
        console.log('Drag and Drop logic repaired via fallback regex.');
    } else {
        console.log('Could not find the drop logic to replace.');
    }
}

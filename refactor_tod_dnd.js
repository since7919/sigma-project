const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// 1. Refactor handlePhaseTodDragStart
const dragStartRegex = /window\.handlePhaseTodDragStart\s*=\s*function\(e,\s*dayIdx,\s*slotIdx\)\s*\{[\s\S]*?setTimeout\(\(\)\s*=>\s*\{[\s\S]*?\}, 10\);\s*\};/;
const cleanDragStart = `window.handlePhaseTodDragStart = function(e, dayIdx, slotIdx) {
    window.__DRAG_TOD = { type: 'phase-tod', dayIdx, slotIdx };
    
    const container = document.getElementById('tod-plan-info-container');
    if (container) container.classList.add('is-dragging-tod');
    
    e.dataTransfer.setData('text/plain', ' ');
    e.dataTransfer.effectAllowed = 'copyMove';
    
    // Create or reuse custom drag image to prevent full-panel ghosting
    let dragImg = document.getElementById('custom-tod-drag-img');
    if (!dragImg) {
        dragImg = document.createElement('div');
        dragImg.id = 'custom-tod-drag-img';
        dragImg.style.cssText = "width: 120px; height: 30px; background: rgba(0, 120, 215, 0.9); color: white; display: flex; align-items: center; justify-content: center; position: absolute; top: -1000px; left: -1000px; border-radius: 4px; font-weight: bold; font-size: 12px; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: -1;";
        dragImg.innerText = "블록 복사 중...";
        document.body.appendChild(dragImg);
    }
    e.dataTransfer.setDragImage(dragImg, 60, 15);
    
    // Highlight siblings
    setTimeout(() => {
        if (container) {
            container.querySelectorAll(\`.phase-tod-cell[data-drop-day="\${dayIdx}"][data-drop-slot="\${slotIdx}"]\`).forEach(el => {
                el.style.opacity = '0.5';
            });
        }
    }, 10);
};`;

if (p.match(dragStartRegex)) {
    p = p.replace(dragStartRegex, cleanDragStart);
}

// 2. Refactor initPhaseTodDnD drop logic (remove alerts, simplify)
const dropRegex = /container\.addEventListener\('drop',\s*\(e\)\s*=>\s*\{[\s\S]*?\}\);/;
const cleanDrop = `container.addEventListener('drop', (e) => {
            e.preventDefault();
            const td = e.target.closest('.phase-tod-cell');
            if (!td) return;
            
            container.querySelectorAll('.drag-hover').forEach(el => {
                el.classList.remove('drag-hover');
                el.style.backgroundColor = '';
            });
            
            try {
                const data = window.__DRAG_TOD;
                if (!data || data.type !== 'phase-tod') return;
                
                const srcDay = data.dayIdx;
                const srcSlot = data.slotIdx;
                const tgtDay = parseInt(td.dataset.dropDay);
                const tgtSlot = parseInt(td.dataset.dropSlot);
                
                if (srcDay === tgtDay && srcSlot === tgtSlot) return;
                
                const j = STATE && STATE.activeJid ? STATE.junctions[STATE.activeJid] : null;
                if (!j || !j.schedules) return;
                
                if (!j.schedules[tgtDay]) j.schedules[tgtDay] = [];
                
                // Copy or Clear logic
                if (!j.schedules[srcDay] || !j.schedules[srcDay][srcSlot]) {
                    j.schedules[tgtDay][tgtSlot] = { h: -1, cycle: 0 };
                } else {
                    j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                }
                
                // Fill any skipped slots before the target slot
                for(let i = 0; i < tgtSlot; i++) {
                    if (!j.schedules[tgtDay][i]) j.schedules[tgtDay][i] = { h: -1, cycle: 0 };
                }
                
                // Trigger UI Updates safely
                if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                if (typeof renderSummaryTable === 'function') renderSummaryTable();
                if (typeof debounceUpdateHeavyUI === 'function') debounceUpdateHeavyUI();
                
                if (STATE && tgtDay === STATE.currentJunctionDayTypeIdx) {
                    const pIdxVal = (typeof UI !== 'undefined' && UI.planIdx) ? parseInt(UI.planIdx.value) : -1;
                    if (tgtSlot === pIdxVal && typeof renderRingTables === 'function') {
                        renderRingTables();
                    }
                }
                
                j._isDirty = true;
                if (typeof updateDBButtonState === 'function') updateDBButtonState();
                
            } catch (err) {
                console.error("Drop Error: ", err);
            } finally {
                window.__DRAG_TOD = null;
            }
        });`;

if (p.match(dropRegex)) {
    p = p.replace(dropRegex, cleanDrop);
}

fs.writeFileSync('SIGMA_SIM/js/phase.js', p, 'utf8');
console.log('REFACTORED PHASE JS');

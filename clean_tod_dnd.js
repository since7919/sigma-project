const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// 1. Find the start and end of initPhaseTodDnD
const startStr = "(function initPhaseTodDnD() {";
const endStr = "})();";

const startIndex = p.lastIndexOf(startStr);
const endIndex = p.lastIndexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const before = p.substring(0, startIndex);
    const after = p.substring(endIndex + endStr.length);
    
    const cleanFunction = `(function initPhaseTodDnD() {
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('tod-plan-info-container');
        if (!container) return;
        
        container.addEventListener('dragend', (e) => {
            container.classList.remove('is-dragging-tod');
            container.querySelectorAll('.phase-tod-cell').forEach(el => el.style.opacity = '1');
            container.querySelectorAll('.drag-hover').forEach(el => {
                el.classList.remove('drag-hover');
                el.style.backgroundColor = '';
            });
        });
        
        container.addEventListener('dragenter', (e) => {
            const td = e.target.closest('.phase-tod-cell');
            if (td) e.preventDefault();
        });
        
        container.addEventListener('dragover', (e) => {
            const td = e.target.closest('.phase-tod-cell');
            if (!td) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            
            const tgtDay = td.dataset.dropDay;
            const tgtSlot = td.dataset.dropSlot;
            
            container.querySelectorAll('.drag-hover').forEach(el => {
                if (el.dataset.dropDay !== tgtDay || el.dataset.dropSlot !== tgtSlot) {
                    el.classList.remove('drag-hover');
                    el.style.backgroundColor = '';
                }
            });
            
            container.querySelectorAll(\`.phase-tod-cell[data-drop-day="\${tgtDay}"][data-drop-slot="\${tgtSlot}"]\`).forEach(el => {
                el.classList.add('drag-hover');
                el.style.backgroundColor = 'rgba(0, 160, 255, 0.3)';
            });
        });
        
        container.addEventListener('drop', (e) => {
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
        });
    });
})();`;

    fs.writeFileSync('SIGMA_SIM/js/phase.js', before + cleanFunction + after, 'utf8');
    console.log("REPLACED IIFE COMPLETELY AND CLEANLY");
} else {
    console.log("COULD NOT FIND BOUNDARIES");
}

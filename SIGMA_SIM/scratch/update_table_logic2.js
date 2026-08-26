const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/table_logic.js', 'utf8');

// We will inject the check for UI.planIdx inside handleSplitInput
const newCode = `
function handleSplitInput(el) {
    const idx = parseInt(el.dataset.index);
    const ring = el.dataset.ring; // "A" or "B"
    const valStr = el.value || "";
    
    // Parse space or comma separated numbers
    const parts = valStr.split(/[\\s,]+/).filter(Boolean);
    const numArr = parts.map(v => parseInt(v, 10) || 0);
    
    // Pad or truncate to 8 elements (standard split array size in SIGMA)
    const splitArr = Array(8).fill(0);
    for (let i = 0; i < Math.min(numArr.length, 8); i++) {
        splitArr[i] = numArr[i];
    }

    if (typeof STATE !== 'undefined' && STATE.activeJid) {
        const j = STATE.junctions[STATE.activeJid];
        if (j && j.dayPlans && j.dayPlans[STATE.currentJunctionDayTypeIdx]) {
            if (ring === 'A') {
                j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].splitA = splitArr;
            } else if (ring === 'B') {
                j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].splitB = splitArr;
            }
            
            // 만약 편집중인 슬롯이 현재 상단에 로드된 슬롯과 같다면, 상단 UI(링 테이블)도 즉시 동기화
            if (typeof UI !== 'undefined' && UI.planIdx && parseInt(UI.planIdx.value) === idx) {
                if (typeof renderRingTables === 'function') renderRingTables();
            }
        }
    }
    
    debounceUpdateHeavyUI();
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}`;

// Replace the old one with the new one
code = code.replace(/function handleSplitInput[\s\S]*?renderTimeSpaceDiagram\(\);\n}/, newCode);

fs.writeFileSync('SIGMA_SIM/js/table_logic.js', code, 'utf8');
console.log("Updated handleSplitInput in table_logic.js");

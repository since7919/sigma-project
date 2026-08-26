const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/table_logic.js', 'utf8');

const oldStr = `            if (type === 'sched') handleSchedInput(e.target);
            else if (type === 'offset') handleOffsetInput(e.target);
        });`;

const newStr = `            if (type === 'sched') handleSchedInput(e.target);
            else if (type === 'offset') handleOffsetInput(e.target);
            else if (type === 'split') handleSplitInput(e.target);
        });`;

code = code.replace(oldStr, newStr);

const handleSplitCode = `
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
        }
    }
    
    debounceUpdateHeavyUI();
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}
`;

// Insert it after handleOffsetInput
code = code.replace(/function handleOffsetInput[\s\S]*?renderTimeSpaceDiagram\(\);\n}/, match => match + "\n" + handleSplitCode);

fs.writeFileSync('SIGMA_SIM/js/table_logic.js', code, 'utf8');
console.log("Updated table_logic.js");

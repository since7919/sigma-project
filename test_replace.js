const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const regexBody = /return `\s*<td class="phase-tod-cell" data-drop-day="\$\{idx\}" data-drop-slot="\$\{rIdx\}" onclick="selectTodPlanCell\(\$\{idx\}, \$\{rIdx\}\)" style="padding: 2px; border-left: 1px solid rgba\(255,255,255,0\.05\); background: \$\{bg\}; cursor: pointer; position: relative;">\s*<div draggable="true" ondragstart="window\.handlePhaseTodDragStart\(event, \$\{idx\}, \$\{rIdx\}\)" style="cursor: grab; color: #555; position: absolute; left: 1px; top: 2px; font-size: 10px; padding: 2px; z-index: 10;" title="드래그하여 스케줄 복사">⠿<\/div>\s*<input type="text" data-day="\$\{idx\}" data-slot="\$\{rIdx\}" data-field="time" class="sigma-input \$\{hCls\}" value="\$\{hVal\}" placeholder="--:--" style="\$\{inputStyle\} color:\$\{fontColor\}; padding-left: 10px; width: calc\(100% - 10px\);" onchange="handleTodPlanEdit\(\$\{idx\}, \$\{rIdx\}, 'time', this\.value\)">\s*<\/td>\s*<td class="phase-tod-cell" data-drop-day="\$\{idx\}" data-drop-slot="\$\{rIdx\}" onclick="selectTodPlanCell\(\$\{idx\}, \$\{rIdx\}\)" style="padding: 2px; background: \$\{bg\}; cursor: pointer;">\s*<input type="number" data-day="\$\{idx\}" data-slot="\$\{rIdx\}" data-field="cycle" class="sigma-input \$\{cycleCls\}" value="\$\{cycleVal\}" placeholder="-" style="\$\{inputStyle\} color:\$\{fontColor\};" onchange="handleTodPlanEdit\(\$\{idx\}, \$\{rIdx\}, 'cycle', this\.value\)">\s*<\/td>\s*<td class="phase-tod-cell" data-drop-day="\$\{idx\}" data-drop-slot="\$\{rIdx\}" onclick="selectTodPlanCell\(\$\{idx\}, \$\{rIdx\}\)" style="padding: 2px; background: \$\{bg\}; font-weight: bold; cursor: pointer;">\s*<input type="number" data-day="\$\{idx\}" data-slot="\$\{rIdx\}" data-field="idx" class="sigma-input \$\{idxCls\}" value="\$\{idxVal\}" placeholder="-" style="\$\{inputStyle\} color:\$\{fontColor\};" onchange="handleTodPlanEdit\(\$\{idx\}, \$\{rIdx\}, 'idx', this\.value\)">\s*<\/td>\s*`;/g;

let newBody = `return \`
                                    <td class="phase-tod-cell" data-drop-day="\${idx}" data-drop-slot="\${rIdx}" onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 2px 0; border-left: 1px solid rgba(255,255,255,0.05); background: \${bg}; cursor: pointer; position: relative;">
                                        <div draggable="true" ondragstart="window.handlePhaseTodDragStart(event, \${idx}, \${rIdx})" style="cursor: grab; color: #777; position: absolute; left: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; padding: 4px 2px; z-index: 10;" title="드래그하여 스케줄 복사">⠿</div>
                                        <div style="display: flex; align-items: center; padding-left: 14px; padding-right: 2px;">
                                            <input type="text" data-day="\${idx}" data-slot="\${rIdx}" data-field="time" class="sigma-input \${hCls}" value="\${hVal}" placeholder="--:--" style="\${inputStyle} flex: 1.5; color:\${fontColor};" onchange="handleTodPlanEdit(\${idx}, \${rIdx}, 'time', this.value)">
                                            <input type="number" data-day="\${idx}" data-slot="\${rIdx}" data-field="cycle" class="sigma-input \${cycleCls}" value="\${cycleVal}" placeholder="-" style="\${inputStyle} flex: 1; color:\${fontColor};" onchange="handleTodPlanEdit(\${idx}, \${rIdx}, 'cycle', this.value)">
                                            <input type="number" data-day="\${idx}" data-slot="\${rIdx}" data-field="idx" class="sigma-input \${idxCls}" value="\${idxVal}" placeholder="-" style="\${inputStyle} flex: 1; font-weight: bold; color:\${fontColor};" onchange="handleTodPlanEdit(\${idx}, \${rIdx}, 'idx', this.value)">
                                        </div>
                                    </td>
                                \`;`;

console.log("Before length:", c.length);
let replaced = c.replace(regexBody, newBody);
console.log("After length:", replaced.length);
console.log("Did it change?", c !== replaced);

if (c !== replaced) {
    fs.writeFileSync('SIGMA_SIM/js/phase.js', replaced, 'utf8');
    console.log("Saved.");
}

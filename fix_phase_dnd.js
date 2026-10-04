const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const regex = /<td onclick="selectTodPlanCell\(\$\{idx\}, \$\{rIdx\}\)" style="padding: 2px; border-left: 1px solid rgba\(255,255,255,0\.05\); background: \$\{bg\}; cursor: pointer;">[\s\S]*?<input type="text" data-day="\$\{idx\}" data-slot="\$\{rIdx\}" data-field="time" class="sigma-input \$\{hCls\}" value="\$\{hVal\}" placeholder="--:--" style="\$\{inputStyle\} color:\$\{fontColor\};" onchange="handleTodPlanEdit\(\$\{idx\}, \$\{rIdx\}, 'time', this\.value\)">[\s\S]*?<\/td>[\s\S]*?<td onclick="selectTodPlanCell\(\$\{idx\}, \$\{rIdx\}\)" style="padding: 2px; background: \$\{bg\}; cursor: pointer;">[\s\S]*?<input type="number" data-day="\$\{idx\}" data-slot="\$\{rIdx\}" data-field="cycle" class="sigma-input \$\{cycleCls\}" value="\$\{cycleVal\}" placeholder="-" style="\$\{inputStyle\} color:\$\{fontColor\};" onchange="handleTodPlanEdit\(\$\{idx\}, \$\{rIdx\}, 'cycle', this\.value\)">[\s\S]*?<\/td>[\s\S]*?<td onclick="selectTodPlanCell\(\$\{idx\}, \$\{rIdx\}\)" style="padding: 2px; background: \$\{bg\}; font-weight: bold; cursor: pointer;">[\s\S]*?<input type="number" data-day="\$\{idx\}" data-slot="\$\{rIdx\}" data-field="idx" class="sigma-input \$\{idxCls\}" value="\$\{idxVal\}" placeholder="-" style="\$\{inputStyle\} color:\$\{fontColor\};" onchange="handleTodPlanEdit\(\$\{idx\}, \$\{rIdx\}, 'idx', this\.value\)">[\s\S]*?<\/td>/;

const newTd = `
                                    <td class="phase-tod-cell" data-drop-day="\${idx}" data-drop-slot="\${rIdx}" onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 2px; border-left: 1px solid rgba(255,255,255,0.05); background: \${bg}; cursor: pointer; position: relative;">
                                        <div draggable="true" ondragstart="window.handlePhaseTodDragStart(event, \${idx}, \${rIdx})" style="cursor: grab; color: #555; position: absolute; left: 1px; top: 2px; font-size: 10px; padding: 2px; z-index: 10;" title="드래그하여 스케줄 복사">⠿</div>
                                        <input type="text" data-day="\${idx}" data-slot="\${rIdx}" data-field="time" class="sigma-input \${hCls}" value="\${hVal}" placeholder="--:--" style="\${inputStyle} color:\${fontColor}; padding-left: 10px; width: calc(100% - 10px);" onchange="handleTodPlanEdit(\${idx}, \${rIdx}, 'time', this.value)">
                                    </td>
                                    <td class="phase-tod-cell" data-drop-day="\${idx}" data-drop-slot="\${rIdx}" onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 2px; background: \${bg}; cursor: pointer;">
                                        <input type="number" data-day="\${idx}" data-slot="\${rIdx}" data-field="cycle" class="sigma-input \${cycleCls}" value="\${cycleVal}" placeholder="-" style="\${inputStyle} color:\${fontColor};" onchange="handleTodPlanEdit(\${idx}, \${rIdx}, 'cycle', this.value)">
                                    </td>
                                    <td class="phase-tod-cell" data-drop-day="\${idx}" data-drop-slot="\${rIdx}" onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 2px; background: \${bg}; font-weight: bold; cursor: pointer;">
                                        <input type="number" data-day="\${idx}" data-slot="\${rIdx}" data-field="idx" class="sigma-input \${idxCls}" value="\${idxVal}" placeholder="-" style="\${inputStyle} color:\${fontColor};" onchange="handleTodPlanEdit(\${idx}, \${rIdx}, 'idx', this.value)">
                                    </td>`;

c = c.replace(regex, newTd);

fs.writeFileSync('SIGMA_SIM/js/phase.js', c, 'utf8');

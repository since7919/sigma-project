const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const regexHead = /<tr style="background: rgba\(255,255,255,0\.05\);">\s*<th style="padding: 2px 4px; border-bottom: 1px solid rgba\(255,255,255,0\.08\); width: 30px; color: #94a3b8;">#<\/th>\s*\$\{dayPlanIndices\.map\(idx => `\s*<th colspan="3" onclick="changeJunctionDayType\(\$\{idx\}\)" style="padding: 2px 4px; border-bottom: 1px solid rgba\(255,255,255,0\.08\); border-left: 1px solid rgba\(255,255,255,0\.08\); color: \$\{dayIdx === idx \? 'var\(--accent\)' : '#94a3b8'\}; cursor: pointer; font-weight: bold; background: \$\{dayIdx === idx \? 'rgba\(241,196,15,0\.05\)' : 'transparent'\};">\s*\$\{DAY_LABELS\[idx\]\}\s*<\/th>\s*`\)\.join\(''\)\}\s*<\/tr>\s*<tr style="background: rgba\(255,255,255,0\.03\);">\s*<th style="padding: 4px; border-bottom: 1px solid rgba\(255,255,255,0\.08\);"><\/th>\s*\$\{dayPlanIndices\.map\(idx => `\s*<th style="padding: 4px; border-bottom: 1px solid rgba\(255,255,255,0\.08\); border-left: 1px solid rgba\(255,255,255,0\.08\); font-weight: normal; color: #94a3b8; font-size: 9px;">TIME<\/th>\s*<th style="padding: 4px; border-bottom: 1px solid rgba\(255,255,255,0\.08\); font-weight: normal; color: #94a3b8; font-size: 9px;">CYC<\/th>\s*<th style="padding: 4px; border-bottom: 1px solid rgba\(255,255,255,0\.08\); font-weight: normal; color: #94a3b8; font-size: 9px;">IDX<\/th>\s*`\)\.join\(''\)\}\s*<\/tr>/g;

let newHead = `<tr style="background: rgba(255,255,255,0.05);">
                        <th style="padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); width: 30px; color: #94a3b8;" rowspan="2">#</th>
                        \${dayPlanIndices.map(idx => \`
                            <th onclick="changeJunctionDayType(\${idx})" style="padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); border-left: 1px solid rgba(255,255,255,0.08); color: \${dayIdx === idx ? 'var(--accent)' : '#94a3b8'}; cursor: pointer; font-weight: bold; background: \${dayIdx === idx ? 'rgba(241,196,15,0.05)' : 'transparent'};">
                                \${DAY_LABELS[idx]}
                            </th>
                        \`).join('')}
                    </tr>
                    <tr style="background: rgba(255,255,255,0.03);">
                        \${dayPlanIndices.map(idx => \`
                            <th style="padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.08); border-left: 1px solid rgba(255,255,255,0.08); font-weight: normal; color: #94a3b8; font-size: 9px;">
                                <div style="display:flex; padding-left:14px; padding-right:2px;">
                                    <span style="flex:1.5;">TIME</span><span style="flex:1;">CYC</span><span style="flex:1;">IDX</span>
                                </div>
                            </th>
                        \`).join('')}
                    </tr>`;

c = c.replace(regexHead, newHead);

const regexBody = /return `\s*<td class="phase-tod-cell" data-drop-day="\$\{idx\}" data-drop-slot="\$\{rIdx\}" onclick="selectTodPlanCell\(\$\{idx\}, \$\{rIdx\}\)" style="padding: 2px; border-left: 1px solid rgba\(255,255,255,0\.05\); background: \$\{bg\}; cursor: pointer; position: relative;">\s*<div draggable="true" ondragstart="window\.handlePhaseTodDragStart\(event, \$\{idx\}, \$\{rIdx\}\)" style="cursor: grab; color: #555; position: absolute; left: 1px; top: 2px; font-size: 10px; padding: 2px; z-index: 10;" title="\?래그하\?\?\?\?\\?복사">\?\?\/div>\s*<input type="text" data-day="\$\{idx\}" data-slot="\$\{rIdx\}" data-field="time" class="sigma-input \$\{hCls\}" value="\$\{hVal\}" placeholder="--:--" style="\$\{inputStyle\} color:\$\{fontColor\}; padding-left: 10px; width: calc\(100% - 10px\);" onchange="handleTodPlanEdit\(\$\{idx\}, \$\{rIdx\}, 'time', this\.value\)">\s*<\/td>\s*<td class="phase-tod-cell" data-drop-day="\$\{idx\}" data-drop-slot="\$\{rIdx\}" onclick="selectTodPlanCell\(\$\{idx\}, \$\{rIdx\}\)" style="padding: 2px; background: \$\{bg\}; cursor: pointer;">\s*<input type="number" data-day="\$\{idx\}" data-slot="\$\{rIdx\}" data-field="cycle" class="sigma-input \$\{cycleCls\}" value="\$\{cycleVal\}" placeholder="-" style="\$\{inputStyle\} color:\$\{fontColor\};" onchange="handleTodPlanEdit\(\$\{idx\}, \$\{rIdx\}, 'cycle', this\.value\)">\s*<\/td>\s*<td class="phase-tod-cell" data-drop-day="\$\{idx\}" data-drop-slot="\$\{rIdx\}" onclick="selectTodPlanCell\(\$\{idx\}, \$\{rIdx\}\)" style="padding: 2px; background: \$\{bg\}; font-weight: bold; cursor: pointer;">\s*<input type="number" data-day="\$\{idx\}" data-slot="\$\{rIdx\}" data-field="idx" class="sigma-input \$\{idxCls\}" value="\$\{idxVal\}" placeholder="-" style="\$\{inputStyle\} color:\$\{fontColor\};" onchange="handleTodPlanEdit\(\$\{idx\}, \$\{rIdx\}, 'idx', this\.value\)">\s*<\/td>\s*`;/g;

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

c = c.replace(regexBody, newBody);

const regexDragStart = /window\.handlePhaseTodDragStart = function\(e, dayIdx, slotIdx\) \{\s*e\.dataTransfer\.setData\('text\/plain', JSON\.stringify\(\{ type: 'phase-tod', dayIdx, slotIdx \}\)\);\s*e\.dataTransfer\.effectAllowed = 'copyMove';/;

const newDragStart = `window.handlePhaseTodDragStart = function(e, dayIdx, slotIdx) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'phase-tod', dayIdx, slotIdx }));
    e.dataTransfer.effectAllowed = 'copyMove';
    
    const td = e.target.closest('.phase-tod-cell');
    if (td) {
        e.dataTransfer.setDragImage(td, 10, 10);
    }`;

c = c.replace(regexDragStart, newDragStart);

c = c.replace(
    /j\.schedules\[tgtDay\]\[tgtSlot\] = JSON\.parse\(JSON\.stringify\(j\.schedules\[srcDay\]\[srcSlot\]\)\);\s*\/\/\s*Re-render\s*renderSummaryTable\(\);/,
    `j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    
                    // Re-render
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    renderSummaryTable();`
);

fs.writeFileSync('SIGMA_SIM/js/phase.js', c, 'utf8');

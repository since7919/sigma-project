const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/junction_optimizer.js', 'utf8');

// 1. Update getDefaultOptState to include LR
code = code.replace(/A: \{ C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 1, TR: 0, R: 0, R_D: 0, CW: 0, CW_D: 0, SPD: 50 \}/g, "A: { C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 1, TR: 0, LR: 0, R: 0, R_D: 0, CW: 0, CW_D: 0, SPD: 50 }");
code = code.replace(/B: \{ C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 0, TR: 0, R: 0, R_D: 0, CW: 0, CW_D: 0, SPD: 50 \}/g, "B: { C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 0, TR: 0, LR: 0, R: 0, R_D: 0, CW: 0, CW_D: 0, SPD: 50 }");

// 2. Add applyLanePresetComposite function
const newFunc = `
window.applyLanePresetComposite = function(dir) {
    if (!opt_state[dir]) return;

    const selBus = document.getElementById(\`preset-bus-\${dir}\`) ? document.getElementById(\`preset-bus-\${dir}\`).value : '';
    const selLeft = document.getElementById(\`preset-left-\${dir}\`) ? document.getElementById(\`preset-left-\${dir}\`).value : '';
    const selStraight = document.getElementById(\`preset-straight-\${dir}\`) ? document.getElementById(\`preset-straight-\${dir}\`).value : '';
    const selRight = document.getElementById(\`preset-right-\${dir}\`) ? document.getElementById(\`preset-right-\${dir}\`).value : '';

    const presetValue = [selBus, selLeft, selStraight, selRight].filter(Boolean).join(',');
    
    if(presetValue) opt_state[dir].active = true;

    const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, LU: 0, LT: 0, TR: 0, LR: 0, R_D: 0 };
    const parts = presetValue.split(',');
    parts.forEach(p => {
        if(!p) return;
        const type = p.replace(/\\d+/g, '').trim();
        const count = parseInt(p.replace(/\\D+/g, '')) || 0;
        if (lanes[type] !== undefined) {
            lanes[type] += count; // combine counts if multiple selects have them
        }
    });

    // Reset relevant lane counts in A
    ['L', 'T', 'R', 'U', 'C', 'LU', 'LT', 'TR', 'LR', 'R_D'].forEach(k => opt_state[dir].A[k] = 0);
    
    // Apply new lanes
    Object.keys(lanes).forEach(k => {
        if (opt_state[dir].A[k] !== undefined) opt_state[dir].A[k] = lanes[k];
    });

    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    saveOptToActiveJunction();
}
`;

if (!code.includes('window.applyLanePresetComposite =')) {
    code += '\n' + newFunc;
}

// 3. Replace the single select with 4 selects in renderTemplatePanel
const oldSelectBlock = `<select class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetToDir('\${d.id}', this.value)"
                style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                \${optionsHtml}
            </select>`;

const newSelectBlock = `<div style="display:flex; flex-direction:column; gap:2px;">
                <select id="preset-bus-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:20px; font-size:10px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                    <option value="">버스...</option>
                    <option value="C1">버스1(C1)</option>
                    <option value="C2">버스2(C2)</option>
                </select>
                <select id="preset-left-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:20px; font-size:10px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                    <option value="">좌회전...</option>
                    <option value="L1">좌1(L1)</option>
                    <option value="L2">좌2(L2)</option>
                    <option value="L3">좌3(L3)</option>
                    <option value="LU1">좌유1(LU1)</option>
                    <option value="LU1,L1">좌유1,좌1</option>
                    <option value="LT1">직좌1(LT1)</option>
                    <option value="LT1,L1">직좌1,좌1</option>
                    <option value="LR1">좌우1(LR1)</option>
                </select>
                <select id="preset-straight-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:20px; font-size:10px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                    <option value="">직진...</option>
                    <option value="T1">직1(T1)</option>
                    <option value="T2">직2(T2)</option>
                    <option value="T3">직3(T3)</option>
                    <option value="T4">직4(T4)</option>
                    <option value="T5">직5(T5)</option>
                </select>
                <select id="preset-right-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:20px; font-size:10px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                    <option value="">우회전...</option>
                    <option value="R1">우1(R1)</option>
                    <option value="R2">우2(R2)</option>
                    <option value="TR1">직우1(TR1)</option>
                    <option value="TR1,R1">직우1,우1</option>
                    <option value="R_D1">우도류1(R_D1)</option>
                </select>
            </div>`;

code = code.replace(oldSelectBlock, newSelectBlock);

fs.writeFileSync('SIGMA_SIM/js/junction_optimizer.js', code, 'utf8');
console.log('Update complete');

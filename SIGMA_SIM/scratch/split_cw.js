const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// 1. Replace the tbodyRowCw generation inside the loop
const oldCwRowGen = /tbodyRowCw \+= `\s*<td colspan="4"[\s\S]*?<\/td>\s*`;/g;
const newCwRowGen = `tbodyRowCw += \`
            <td style="padding:2px; border:1px solid #444; background:rgba(0,0,0,0.1);"></td>
            <td style="padding:2px; border:1px solid #444; text-align:center; background:rgba(0,0,0,0.1);">
                <div style="display:inline-flex; align-items:center; gap:2px; justify-content:center;">
                    <input type="number" id="preset-cw-l-\${d.id}" class="preset-cw-input" data-dir="\${d.id}" onchange="applyCwLengthToDir('\${d.id}', 'L')" style="width:36px; height:20px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; text-align:right; padding-right:2px;" min="0" placeholder="0">
                    <span style="font-size:10px; color:#aaa;">m</span>
                </div>
            </td>
            <td style="padding:2px; border:1px solid #444; text-align:center; background:rgba(0,0,0,0.1);">
                <div style="display:inline-flex; align-items:center; gap:2px; justify-content:center;">
                    <input type="number" id="preset-cw-t-\${d.id}" class="preset-cw-input" data-dir="\${d.id}" onchange="applyCwLengthToDir('\${d.id}', 'T')" style="width:36px; height:20px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; text-align:right; padding-right:2px;" min="0" placeholder="0">
                    <span style="font-size:10px; color:#aaa;">m</span>
                </div>
            </td>
            <td style="padding:2px; border:1px solid #444; text-align:center; background:rgba(0,0,0,0.1);">
                <div style="display:inline-flex; align-items:center; gap:2px; justify-content:center;">
                    <input type="number" id="preset-cw-r-\${d.id}" class="preset-cw-input" data-dir="\${d.id}" onchange="applyCwLengthToDir('\${d.id}', 'R')" style="width:36px; height:20px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; text-align:right; padding-right:2px;" min="0" placeholder="0">
                    <span style="font-size:10px; color:#aaa;">m</span>
                </div>
            </td>
        \`;`;
js = js.replace(oldCwRowGen, newCwRowGen);

// 2. Replace applyCwLengthToDir
const oldApplyCw = /window\.applyCwLengthToDir = function\(dir\) \{[\s\S]*?^\};/m;
const newApplyCw = `window.applyCwLengthToDir = function(dir, type) {
    if (!opt_state[dir]) return;
    const input = document.getElementById(\`preset-cw-\${type.toLowerCase()}-\${dir}\`);
    if (!input) return;
    
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= 0) {
        if (type === 'L') opt_state[dir].A.CW_L = val;
        else if (type === 'T') opt_state[dir].A.CW = val;
        else if (type === 'R') opt_state[dir].A.CW_D = val;
        
        // Optionally activate if length > 0
        if (val > 0) opt_state[dir].active = true;
        
        renderOptimizer();
        renderOptimizerStats();
        if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
        saveOptToActiveJunction();
    }
};`;
js = js.replace(oldApplyCw, newApplyCw);

// 3. Update updateTemplatePanelUI where cwInput is set
const oldUpdateUI = /const cwInput = document\.getElementById\(`preset-cw-\$\{d\.id\}`\);[\s\S]*?if\s*\(cwTd\)\s*cwTd\.style\.opacity\s*=\s*'0\.4';\s*cwInput\.disabled\s*=\s*true;\s*\}\s*\}/g;
const newUpdateUI = `const cwL = document.getElementById(\`preset-cw-l-\${d.id}\`);
                const cwT = document.getElementById(\`preset-cw-t-\${d.id}\`);
                const cwR = document.getElementById(\`preset-cw-r-\${d.id}\`);
                
                if (cwL) { cwL.value = opt_state[d.id].A.CW_L || 0; cwL.disabled = !isActive; cwL.closest('td').style.opacity = isActive ? '1' : '0.4'; }
                if (cwT) { cwT.value = opt_state[d.id].A.CW || 0; cwT.disabled = !isActive; cwT.closest('td').style.opacity = isActive ? '1' : '0.4'; }
                if (cwR) { cwR.value = opt_state[d.id].A.CW_D || 0; cwR.disabled = !isActive; cwR.closest('td').style.opacity = isActive ? '1' : '0.4'; }`;
js = js.replace(oldUpdateUI, newUpdateUI);

// 4. Update getDefaultOptState to include CW_L
js = js.replace(
    /A: \{ C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 1, TR: 0, LR: 0, R: 0, R_D: 0, CW: 0, CW_D: 0, SPD: 50 \},/,
    `A: { C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 1, TR: 0, LR: 0, R: 0, R_D: 0, CW: 0, CW_L: 0, CW_D: 0, SPD: 50 },`
);
js = js.replace(
    /B: \{ C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 0, TR: 0, LR: 0, R: 0, R_D: 0, CW: 0, CW_D: 0, SPD: 50 \},/,
    `B: { C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 0, TR: 0, LR: 0, R: 0, R_D: 0, CW: 0, CW_L: 0, CW_D: 0, SPD: 50 },`
);

fs.writeFileSync(path, js);
console.log('Successfully updated crosswalk inputs in junction_optimizer.js');

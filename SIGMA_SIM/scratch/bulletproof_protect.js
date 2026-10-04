const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

const applyProtectRegex = /window\.applyProtectToDir = function\(dir\) \{[\s\S]*?(?=window\.applySpdToDir = function\(dir\) \{)/;
const applyProtectNew = `window.applyProtectToDir = function(dir) {
    console.log('[DEBUG] applyProtectToDir invoked for', dir);
    if (!opt_state || !opt_state[dir]) return;
    const sel = document.getElementById(\`preset-protect-\${dir}\`);
    if (!sel) return;
    
    const val = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].value : sel.value;
    console.log('[DEBUG] selected val:', val);
    
    // 명시적 boolean 할당
    opt_state[dir].children = (val === 'children');
    opt_state[dir].elderly = (val === 'elderly');
    opt_state[dir].disabled = (val === 'disabled');
    opt_state[dir].adjacent = (val === 'adjacent');
    
    if (val !== 'none') {
        if (!opt_state[dir].A) opt_state[dir].A = {};
        if (!opt_state[dir].B) opt_state[dir].B = {};
        opt_state[dir].A.SPD = 30;
        opt_state[dir].B.SPD = 30;
        const spdInput = document.getElementById(\`preset-spd-\${dir}\`);
        if (spdInput) spdInput.value = 30;
    }
    
    try {
        if (typeof renderOptimizer === 'function') renderOptimizer();
        if (typeof renderOptimizerStats === 'function') renderOptimizerStats();
        if (typeof saveOptToActiveJunction === 'function') saveOptToActiveJunction();
        
        // 상세 패널(Unified) 동기화
        if (opt_curId === dir) {
            ['children', 'elderly', 'disabled', 'adjacent'].forEach(k => {
                const chk = document.querySelector(\`#lane-fields-unified input[data-key="\${k}"]\`);
                if (chk) chk.checked = (val === k);
            });
            if (val !== 'none') {
                document.querySelectorAll('#lane-fields-unified input[data-type="SPD"]').forEach(i => {
                    i.value = 30;
                });
            }
        }
        
        // 명시적으로 UI 상태 고정
        sel.value = val;
    } catch (e) {
        console.error('[DEBUG] applyProtectToDir Error:', e);
    }
};
`;
js = js.replace(applyProtectRegex, applyProtectNew);

const updateUiRegex = /window\.updateTemplatePanelUI = function\(\) \{[\s\S]*?(?=window\.applyLanePresetComposite = function\(dir\) \{)/;
const updateUiNew = `window.updateTemplatePanelUI = function() {
    OPT_DIRS.forEach(d => {
        const chk = document.getElementById(\`chk-preset-\${d.id}\`);
        const sels = document.querySelectorAll(\`.preset-select[data-dir="\${d.id}"]\`);
        
        if (chk && opt_state[d.id]) {
            const isActive = !!opt_state[d.id].active;
            chk.checked = isActive;
            
            const cwL = document.getElementById(\`preset-cw-l-\${d.id}\`);
            const cwT = document.getElementById(\`preset-cw-t-\${d.id}\`);
            const cwR = document.getElementById(\`preset-cw-r-\${d.id}\`);
            
            if (cwL) { cwL.value = (opt_state[d.id].A && opt_state[d.id].A.CW_L) || 0; cwL.disabled = !isActive; cwL.closest('td').style.opacity = isActive ? '1' : '0.4'; }
            if (cwT) { cwT.value = (opt_state[d.id].A && opt_state[d.id].A.CW) || 0; cwT.disabled = !isActive; cwT.closest('td').style.opacity = isActive ? '1' : '0.4'; }
            if (cwR) { cwR.value = (opt_state[d.id].A && opt_state[d.id].A.CW_D) || 0; cwR.disabled = !isActive; cwR.closest('td').style.opacity = isActive ? '1' : '0.4'; }

            const spd = document.getElementById(\`preset-spd-\${d.id}\`);
            if (spd) { spd.value = (opt_state[d.id].A && opt_state[d.id].A.SPD) || 50; spd.disabled = !isActive; spd.closest('td').style.opacity = isActive ? '1' : '0.4'; }

            const protect = document.getElementById(\`preset-protect-\${d.id}\`);
            if (protect) {
                if (opt_state[d.id].children === true) protect.value = 'children';
                else if (opt_state[d.id].elderly === true) protect.value = 'elderly';
                else if (opt_state[d.id].disabled === true) protect.value = 'disabled';
                else if (opt_state[d.id].adjacent === true) protect.value = 'adjacent';
                else protect.value = 'none';
                protect.disabled = !isActive;
            }

            sels.forEach(sel => {
                const td = sel.parentElement;
                if (isActive) {
                    if (td) td.style.opacity = '1';
                    sel.disabled = false;
                } else {
                    if (td) td.style.opacity = '0.4';
                    sel.disabled = true;
                }
            });
        }
    });
};
`;
js = js.replace(updateUiRegex, updateUiNew);

fs.writeFileSync(path, js);
console.log('Fixed applyProtectToDir and updateTemplatePanelUI');

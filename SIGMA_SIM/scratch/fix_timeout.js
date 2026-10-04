const fs = require('fs');
let js = fs.readFileSync('../js/junction_optimizer.js', 'utf8');

const targetFunc = `window.applyProtectToDir = function(selOrDir, optionalDir) {
    // 호환성 처리 (인자가 1개로 올 경우와 2개로 올 경우)
    let sel, dir;
    if (typeof optionalDir === 'string') {
        sel = selOrDir;
        dir = optionalDir;
    } else {
        dir = selOrDir;
        sel = document.getElementById(\`preset-protect-\${dir}\`);
    }

    console.log('[DEBUG] applyProtectToDir invoked for', dir);
    if (!opt_state || !opt_state[dir]) return;
    if (!sel) return;
    
    const val = sel.value; // Get value directly from the passed element
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
        
    } catch (e) {
        console.error('[DEBUG] applyProtectToDir Error:', e);
    }
};`;

const newFunc = `window.applyProtectToDir = function(selOrDir, optionalDir) {
    let sel, dir;
    if (typeof optionalDir === 'string') {
        sel = selOrDir;
        dir = optionalDir;
    } else {
        dir = selOrDir;
        sel = document.getElementById(\`preset-protect-\${dir}\`);
    }

    setTimeout(() => {
        console.log('[DEBUG] applyProtectToDir invoked for', dir);
        if (!opt_state || !opt_state[dir]) return;
        if (!sel) return;
        
        const val = sel.value;
        console.log('[DEBUG] selected val async:', val);
        
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
        } catch (e) {
            console.error('[DEBUG] applyProtectToDir Error:', e);
        }
    }, 50);
};`;

if (js.includes(targetFunc)) {
    js = js.replace(targetFunc, newFunc);
    fs.writeFileSync('../js/junction_optimizer.js', js);
    console.log('Added setTimeout to applyProtectToDir');
} else {
    console.log('Could not find applyProtectToDir target function');
}

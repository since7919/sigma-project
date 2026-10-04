const fs = require('fs');
let js = fs.readFileSync('../js/junction_optimizer.js', 'utf8');

const startStr = 'window.applyProtectToDir = function(selOrDir, optionalDir) {';
const startIndex = js.indexOf(startStr);
const nextWindowFunc = js.indexOf('window.', startIndex + 10);

const newFunc = `window.applyProtectToDir = function(selOrDir, optionalDir) {
    let sel, dir;
    if (typeof optionalDir === 'string') {
        sel = selOrDir;
        dir = optionalDir;
    } else {
        dir = selOrDir;
        sel = document.getElementById(\`preset-protect-\${dir}\`);
    }

    // Force read the value immediately and also async
    const immediateVal = sel ? sel.value : 'none';
    console.log('[DEBUG] selected val sync:', immediateVal);

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
};\n\n`;

if (startIndex !== -1 && nextWindowFunc !== -1) {
    js = js.substring(0, startIndex) + newFunc + js.substring(nextWindowFunc);
    fs.writeFileSync('../js/junction_optimizer.js', js);
    console.log('Successfully replaced applyProtectToDir with async version.');
} else {
    console.log('Could not find boundaries.');
}

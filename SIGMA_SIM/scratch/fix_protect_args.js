const fs = require('fs');
let js = fs.readFileSync('../js/junction_optimizer.js', 'utf8');

// Update HTML to pass 'this'
js = js.replace(/onchange="applyProtectToDir\('\$\{d\.id\}'\)"/g, 'onchange="applyProtectToDir(this, \'${d.id}\')"');

// Update applyProtectToDir signature and logic
const targetFunc = `window.applyProtectToDir = function(dir) {
    console.log('[DEBUG] applyProtectToDir invoked for', dir);
    if (!opt_state || !opt_state[dir]) return;
    const sel = document.getElementById(\`preset-protect-\${dir}\`);
    if (!sel) return;
    
    const val = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].value : sel.value;`;

const newFunc = `window.applyProtectToDir = function(selOrDir, optionalDir) {
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
    
    const val = sel.value; // Get value directly from the passed element`;

if (js.includes(targetFunc)) {
    js = js.replace(targetFunc, newFunc);
    fs.writeFileSync('../js/junction_optimizer.js', js);
    console.log('Updated applyProtectToDir successfully.');
} else {
    console.log('Could not find target function in junction_optimizer.js');
}

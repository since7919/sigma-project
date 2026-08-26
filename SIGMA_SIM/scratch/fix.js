const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/junction_optimizer.js', 'utf-8');

const target = `    ['emgFireSt', 'emgFireTr', 'etcOper', 'etcSpare1'].forEach(k => {
        const c = document.querySelector(\`input[data-j="\${k}"]\`);
        if (c) c.checked = !!opt_junctionState[k];
    });

function saveOptToActiveJunction() {`;

const replacement = `    ['emgFireSt', 'emgFireTr', 'etcOper', 'etcSpare1'].forEach(k => {
        const c = document.querySelector(\`input[data-j="\${k}"]\`);
        if (c) c.checked = !!opt_junctionState[k];
    });

    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();

    const firstActive = OPT_DIRS.find(d => opt_state[d.id].active);
    if (firstActive) selectOptDir(firstActive.id);
    else selectOptDir('N');
}

/**
 * Optimizer State를 Active Junction 데이터에 저장
 */
function saveOptToActiveJunction() {`;

// replace with regex to ignore spacing between the end of forEach and the start of the next function
content = content.replace(/    \['emgFireSt', 'emgFireTr', 'etcOper', 'etcSpare1'\]\.forEach\(k => \{\r?\n        const c = document\.querySelector\(`input\[data-j="\$\{k\}"\]`\);\r?\n        if \(c\) c\.checked = !!opt_junctionState\[k\];\r?\n    \}\);[\s\S]*?function saveOptToActiveJunction\(\) \{/, replacement);

fs.writeFileSync('SIGMA_SIM/js/junction_optimizer.js', content, 'utf-8');

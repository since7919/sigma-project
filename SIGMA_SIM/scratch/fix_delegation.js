const fs = require('fs');
let js = fs.readFileSync('../js/junction_optimizer.js', 'utf8');

// 1. Remove inline onchange
js = js.replace(/<select id="preset-protect-\$\{d\.id\}" onchange="applyProtectToDir\(this, '\$\{d\.id\}'\)"/g, '<select id="preset-protect-${d.id}" class="protect-dropdown" data-dir="${d.id}"');

// 2. Add event delegation in initOptimizer
const initTarget = `    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
}`;
const initNew = `    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    
    // Event delegation for protect dropdown
    const container = document.getElementById('opt-template-container');
    if (container && !container.dataset.delegated) {
        container.dataset.delegated = 'true';
        container.addEventListener('change', (e) => {
            if (e.target && e.target.classList.contains('protect-dropdown')) {
                const dir = e.target.dataset.dir;
                if (dir && typeof window.applyProtectToDir === 'function') {
                    window.applyProtectToDir(e.target, dir);
                }
            }
        });
    }
}`;
if (js.includes(initTarget)) {
    js = js.replace(initTarget, initNew);
    fs.writeFileSync('../js/junction_optimizer.js', js);
    console.log('Applied event delegation.');
} else {
    console.log('Could not find target string in initOptimizer');
}

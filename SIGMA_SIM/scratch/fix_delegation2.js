const fs = require('fs');
let js = fs.readFileSync('../js/junction_optimizer.js', 'utf8');

// 1. Remove inline onchange
js = js.replace(/<select id="preset-protect-\$\{d\.id\}" onchange="applyProtectToDir\(this, '\$\{d\.id\}'\)"/g, '<select id="preset-protect-${d.id}" class="protect-dropdown" data-dir="${d.id}"');

// 2. Add event delegation in renderTemplatePanel
const target = `    fU.parentNode.insertBefore(panel, fU);
}`;
const newTarget = `    fU.parentNode.insertBefore(panel, fU);

    if (!window.__sigmaProtectDelegated) {
        window.__sigmaProtectDelegated = true;
        document.addEventListener('change', (e) => {
            if (e.target && e.target.classList.contains('protect-dropdown')) {
                const dir = e.target.dataset.dir;
                if (dir && typeof window.applyProtectToDir === 'function') {
                    window.applyProtectToDir(e.target, dir);
                }
            }
        });
    }
}`;

if (js.includes(target)) {
    js = js.replace(target, newTarget);
    fs.writeFileSync('../js/junction_optimizer.js', js);
    console.log('Applied event delegation to renderTemplatePanel.');
} else {
    console.log('Could not find target in renderTemplatePanel');
}

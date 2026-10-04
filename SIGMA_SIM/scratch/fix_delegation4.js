const fs = require('fs');
let js = fs.readFileSync('../js/junction_optimizer.js', 'utf8');

const oldCode = `document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('protect-dropdown')) {
            const dir = e.target.dataset.dir;
            if (dir && typeof window.applyProtectToDir === 'function') {
                window.applyProtectToDir(e.target, dir);
            }
        }
    });
});`;

const newCode = `document.addEventListener('change', (e) => {
    if (e.target && e.target.classList.contains('protect-dropdown')) {
        const dir = e.target.dataset.dir;
        if (dir && typeof window.applyProtectToDir === 'function') {
            window.applyProtectToDir(e.target, dir);
        }
    }
});`;

if (js.includes(oldCode)) {
    js = js.replace(oldCode, newCode);
    fs.writeFileSync('../js/junction_optimizer.js', js);
    console.log('Fixed delegation scope');
} else {
    console.log('Could not find old code');
}

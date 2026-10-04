const fs = require('fs');
let js = fs.readFileSync('../js/junction_optimizer.js', 'utf8');

js = js.replace(/<select id="preset-protect-\$\{d\.id\}" onchange="applyProtectToDir\(this, '\$\{d\.id\}'\)"/g, '<select id="preset-protect-${d.id}" class="protect-dropdown" data-dir="${d.id}"');

const codeToAppend = `
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('protect-dropdown')) {
            const dir = e.target.dataset.dir;
            if (dir && typeof window.applyProtectToDir === 'function') {
                window.applyProtectToDir(e.target, dir);
            }
        }
    });
});
`;
fs.writeFileSync('../js/junction_optimizer.js', js + codeToAppend);
console.log('Appended global delegation.');

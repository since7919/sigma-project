const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// 1. Change row title
js = js.replace(
    /let tbodyRowSpd = `<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba\(255,255,255,0\.05\);">제한속도<\/td>`;/,
    'let tbodyRowSpd = `<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">제한속도<br><span style="font-size:9px; font-weight:normal;">/보호구역</span></td>`;'
);

// 2. Change cell content
js = js.replace(
    /        tbodyRowSpd \+= `\n            <td colspan="4" style="padding:2px; border:1px solid #444; text-align:center; background:rgba\(0,0,0,0\.1\);">\n                <div style="display:inline-flex; align-items:center; gap:2px; justify-content:center;">\n                    <input type="number" id="preset-spd-\$\{d\.id\}" class="preset-spd-input" data-dir="\$\{d\.id\}" onchange="applySpdToDir\('\$\{d\.id\}'\)" style="width:40px; height:20px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; text-align:right; padding-right:2px;" min="0" step="10" placeholder="50">\n                    <span style="font-size:10px; color:#aaa;">km\/h<\/span>\n                <\/div>\n            <\/td>\n        `;/g,
    `        tbodyRowSpd += \`
            <td colspan="4" style="padding:2px; border:1px solid #444; text-align:center; background:rgba(0,0,0,0.1);">
                <div style="display:inline-flex; align-items:center; gap:8px; justify-content:center;">
                    <div style="display:inline-flex; align-items:center; gap:2px;">
                        <input type="number" id="preset-spd-\${d.id}" class="preset-spd-input" data-dir="\${d.id}" onchange="applySpdToDir('\${d.id}')" style="width:36px; height:20px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; text-align:right; padding-right:2px;" min="0" step="10" placeholder="50">
                        <span style="font-size:10px; color:#aaa;">km/h</span>
                    </div>
                    <label style="display:inline-flex; align-items:center; gap:2px; font-size:10px; color:#ddd; cursor:pointer;" title="어린이 보호구역">
                        <input type="checkbox" id="preset-protect-\${d.id}" onchange="applyProtectToDir('\${d.id}')" style="margin:0;">
                        보호
                    </label>
                </div>
            </td>
        \`;`
);

// 3. Update updateTemplatePanelUI
js = js.replace(
    /const spd = document\.getElementById\(`preset-spd-\$\{d\.id\}`\);\n                if \(spd\) \{ spd\.value = opt_state\[d\.id\]\.A\.SPD \|\| 50; spd\.disabled = !isActive; spd\.closest\('td'\)\.style\.opacity = isActive \? '1' : '0\.4'; \}/,
    `const spd = document.getElementById(\`preset-spd-\${d.id}\`);
                if (spd) { spd.value = opt_state[d.id].A.SPD || 50; spd.disabled = !isActive; spd.closest('td').style.opacity = isActive ? '1' : '0.4'; }

                const protect = document.getElementById(\`preset-protect-\${d.id}\`);
                if (protect) { protect.checked = !!opt_state[d.id].children; protect.disabled = !isActive; }`
);

// 4. Add applyProtectToDir function
const fn = `
window.applyProtectToDir = function(dir) {
    if (!opt_state[dir]) return;
    const chk = document.getElementById(\`preset-protect-\${dir}\`);
    if (!chk) return;
    
    opt_state[dir].children = chk.checked;
    if (chk.checked) {
        opt_state[dir].A.SPD = 30;
        opt_state[dir].B.SPD = 30;
        const spdInput = document.getElementById(\`preset-spd-\${dir}\`);
        if (spdInput) spdInput.value = 30;
    }
    
    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    saveOptToActiveJunction();
    
    if (opt_curId === dir) {
        document.querySelectorAll('#lane-fields-unified input[type="checkbox"]').forEach(i => {
            if (i.dataset.key === 'children') i.checked = chk.checked;
        });
        if (chk.checked) {
            document.querySelectorAll('#lane-fields-unified input[type="number"]').forEach(i => {
                if (i.dataset.type === 'SPD') i.value = 30;
            });
        }
    }
};
`;

js = js.replace(
    /window\.applySpdToDir = function\(dir\) \{/,
    `${fn}\nwindow.applySpdToDir = function(dir) {`
);

fs.writeFileSync(path, js);
console.log('Added protection zone checkbox and logic');

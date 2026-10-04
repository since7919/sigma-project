const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// 1. Revert row title
js = js.replace(
    /let tbodyRowSpd = `<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba\(255,255,255,0\.05\);">제한속도<br><span style="font-size:9px; font-weight:normal;">\/보호구역<\/span><\/td>`;/,
    'let tbodyRowSpd = `<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">제한속도</td>`;'
);

// 2. Change checkbox to dropdown
js = js.replace(
    /<label style="display:inline-flex; align-items:center; gap:2px; font-size:10px; color:#ddd; cursor:pointer;" title="어린이 보호구역">\s*<input type="checkbox" id="preset-protect-\$\{d\.id\}" onchange="applyProtectToDir\('\$\{d\.id\}'\)" style="margin:0;">\s*보호\s*<\/label>/g,
    `<select id="preset-protect-\${d.id}" onchange="applyProtectToDir('\${d.id}')" style="width:65px; height:20px; font-size:10px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                        <option value="none">해당없음</option>
                        <option value="children">어린이</option>
                        <option value="elderly">노인</option>
                        <option value="disabled">장애인</option>
                    </select>`
);

// 3. Update updateTemplatePanelUI logic
js = js.replace(
    /const protect = document\.getElementById\(`preset-protect-\$\{d\.id\}`\);\n\s*if \(protect\) \{ protect\.checked = !!opt_state\[d\.id\]\.children; protect\.disabled = !isActive; \}/,
    `const protect = document.getElementById(\`preset-protect-\${d.id}\`);
                if (protect) {
                    if (opt_state[d.id].children) protect.value = 'children';
                    else if (opt_state[d.id].elderly) protect.value = 'elderly';
                    else if (opt_state[d.id].disabled) protect.value = 'disabled';
                    else protect.value = 'none';
                    protect.disabled = !isActive;
                }`
);

// 4. Update applyProtectToDir logic
const oldFnRegex = /window\.applyProtectToDir = function\(dir\) \{[\s\S]*?(?=window\.applySpdToDir = function\(dir\) \{)/;
const newFn = `window.applyProtectToDir = function(dir) {
    if (!opt_state[dir]) return;
    const sel = document.getElementById(\`preset-protect-\${dir}\`);
    if (!sel) return;
    
    const val = sel.value;
    opt_state[dir].children = (val === 'children');
    opt_state[dir].elderly = (val === 'elderly');
    opt_state[dir].disabled = (val === 'disabled');
    
    if (val !== 'none') {
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
            if (i.dataset.key === 'children') i.checked = opt_state[dir].children;
            if (i.dataset.key === 'elderly') i.checked = opt_state[dir].elderly;
            if (i.dataset.key === 'disabled') i.checked = opt_state[dir].disabled;
        });
        if (val !== 'none') {
            document.querySelectorAll('#lane-fields-unified input[type="number"]').forEach(i => {
                if (i.dataset.type === 'SPD') i.value = 30;
            });
        }
    }
};
`;

js = js.replace(oldFnRegex, newFn + '\n');

fs.writeFileSync(path, js);
console.log('Updated protection zone to a dropdown');

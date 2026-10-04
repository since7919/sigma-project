const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// 1. Add tbodyRowCw declaration
js = js.replace(
    /let tbodyRow = `<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba\(255,255,255,0.05\);">차로 프리셋<\/td>`;/,
    `let tbodyRow = \`<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">차로 프리셋</td>\`;\n    let tbodyRowCw = \`<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">횡단보도</td>\`;`
);

// 2. Add tbodyRowCw generation inside the loop
js = js.replace(
    /(\s*)<\/td>\s*`;\s*}\);/g,
    `$1</td>\n        \`;\n\n        tbodyRowCw += \`\n            <td colspan="4" style="padding:2px; border:1px solid #444; text-align:center; background:rgba(0,0,0,0.1);">\n                <div style="display:inline-flex; align-items:center; gap:4px; justify-content:center;">\n                    <input type="number" id="preset-cw-\${d.id}" class="preset-cw-input" data-dir="\${d.id}" onchange="applyCwLengthToDir('\${d.id}')" style="width:40px; height:20px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; text-align:right; padding-right:4px;" min="0" placeholder="0">\n                    <span style="font-size:11px; color:#aaa;">m</span>\n                </div>\n            </td>\n        \`;\n    });`
);

// 3. Add closing </tr> and inject into <tbody>
js = js.replace(
    /tbodyRow \+= `<\/tr>`;/,
    `tbodyRow += \`</tr>\`;\n    tbodyRowCw += \`</tr>\`;`
);

js = js.replace(
    /\${tbodyRow}\s*<\/tbody>/,
    `\${tbodyRow}\n                    \${tbodyRowCw}\n                </tbody>`
);

// 4. Update updateTemplatePanelUI
const uiUpdateRegex = /(chk\.checked = isActive;\s*sels\.forEach\(sel => \{)/;
js = js.replace(uiUpdateRegex, `$1
                const cwInput = document.getElementById(\`preset-cw-\${d.id}\`);
                if (cwInput) {
                    cwInput.value = opt_state[d.id].A.CW || 0;
                    const cwTd = cwInput.closest('td');
                    if (isActive) {
                        if (cwTd) cwTd.style.opacity = '1';
                        cwInput.disabled = false;
                    } else {
                        if (cwTd) cwTd.style.opacity = '0.4';
                        cwInput.disabled = true;
                    }
                }
`);

// 5. Add applyCwLengthToDir function
if (!js.includes('window.applyCwLengthToDir')) {
    js += `
window.applyCwLengthToDir = function(dir) {
    if (!opt_state[dir]) return;
    const input = document.getElementById(\`preset-cw-\${dir}\`);
    if (!input) return;
    
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= 0) {
        opt_state[dir].A.CW = val;
        // Optionally activate if length > 0
        if (val > 0) opt_state[dir].active = true;
        
        renderOptimizer();
        renderOptimizerStats();
        if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
        saveOptToActiveJunction();
    }
};
`;
}

fs.writeFileSync(path, js);
console.log('Successfully patched junction_optimizer.js for crosswalk length input.');

const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// 1. Add tbodyRowSpd initialization
js = js.replace(
    /let tbodyRowCw = `<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba\(255,255,255,0\.05\);">횡단보도<\/td>`;/,
    `let tbodyRowCw = \`<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">횡단보도</td>\`;\n    let tbodyRowSpd = \`<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">제한속도</td>\`;`
);

// 2. Add speed input inside the loop
js = js.replace(
    /tbodyRowCw \+= `<\/tr>`;/,
    "tbodyRowCw += `</tr>`;" // Just to anchor, wait, let's inject before it
);
// Actually, let's inject inside the loop. The loop ends with:
//         `;
//         
//     });
//     tbodyRow += `</tr>`;
//     tbodyRowCw += `</tr>`;
// So I can replace:
js = js.replace(
    /        tbodyRowCw \+= `([^`]*)`;\n\n    }\);/m,
    "        tbodyRowCw += `$1`;\n\n        tbodyRowSpd += `\n            <td colspan=\"4\" style=\"padding:2px; border:1px solid #444; text-align:center; background:rgba(0,0,0,0.1);\">\n                <div style=\"display:inline-flex; align-items:center; gap:2px; justify-content:center;\">\n                    <input type=\"number\" id=\"preset-spd-${d.id}\" class=\"preset-spd-input\" data-dir=\"${d.id}\" onchange=\"applySpdToDir('${d.id}')\" style=\"width:40px; height:20px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; text-align:right; padding-right:2px;\" min=\"0\" step=\"10\" placeholder=\"50\">\n                    <span style=\"font-size:10px; color:#aaa;\">km/h</span>\n                </div>\n            </td>\n        `;\n\n    });"
);

// 3. Add closing tag and add to table
js = js.replace(
    /    tbodyRowCw \+= `<\/tr>`;/,
    "    tbodyRowCw += `</tr>`;\n    tbodyRowSpd += `</tr>`;"
);

js = js.replace(
    /\$\{tbodyRowCw\}/,
    "${tbodyRowCw}\n                    ${tbodyRowSpd}"
);

// 4. Add applySpdToDir function
const fn = `
window.applySpdToDir = function(dir) {
    if (!opt_state[dir]) return;
    const input = document.getElementById(\`preset-spd-\${dir}\`);
    if (!input) return;
    
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= 0) {
        opt_state[dir].A.SPD = val;
        opt_state[dir].B.SPD = val;
        
        renderOptimizer();
        renderOptimizerStats();
        if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
        saveOptToActiveJunction();
        
        if (opt_curId === dir) {
            document.querySelectorAll('#lane-fields-unified input[type="number"]').forEach(i => {
                if (i.dataset.type === 'SPD') i.value = val;
            });
        }
    }
};
`;

js = js.replace(
    /window\.applyCwLengthToDir = function\(dir, type\) \{[\s\S]*?^\};\n/m,
    `$&${fn}`
);

// 5. Update updateTemplatePanelUI
js = js.replace(
    /if \(cwR\) \{ cwR\.value = opt_state\[d\.id\]\.A\.CW_D \|\| 0; cwR\.disabled = !isActive; cwR\.closest\('td'\)\.style\.opacity = isActive \? '1' : '0\.4'; \}/,
    `if (cwR) { cwR.value = opt_state[d.id].A.CW_D || 0; cwR.disabled = !isActive; cwR.closest('td').style.opacity = isActive ? '1' : '0.4'; }\n\n                const spd = document.getElementById(\`preset-spd-\${d.id}\`);\n                if (spd) { spd.value = opt_state[d.id].A.SPD || 50; spd.disabled = !isActive; spd.closest('td').style.opacity = isActive ? '1' : '0.4'; }`
);

fs.writeFileSync(path, js);
console.log('Added speed limit row and functionality');

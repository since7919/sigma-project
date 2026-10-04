const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

js = js.replace(
    /        `;\n    }\);\n\n    tbodyRow \+= `<\/tr>`;/m,
    `        \`;\n\n        tbodyRowSpd += \`\n            <td colspan="4" style="padding:2px; border:1px solid #444; text-align:center; background:rgba(0,0,0,0.1);">\n                <div style="display:inline-flex; align-items:center; gap:2px; justify-content:center;">\n                    <input type="number" id="preset-spd-\${d.id}" class="preset-spd-input" data-dir="\${d.id}" onchange="applySpdToDir('\${d.id}')" style="width:40px; height:20px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; text-align:right; padding-right:2px;" min="0" step="10" placeholder="50">\n                    <span style="font-size:10px; color:#aaa;">km/h</span>\n                </div>\n            </td>\n        \`;\n    });\n\n    tbodyRow += \`</tr>\`;`
);

fs.writeFileSync(path, js);
console.log('Injected missing tbodyRowSpd logic into loop');

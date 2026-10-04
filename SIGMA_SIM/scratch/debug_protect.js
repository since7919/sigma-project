const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

const applyProtectTarget = `    const val = sel.value;
    opt_state[dir].children = (val === 'children');
    opt_state[dir].elderly = (val === 'elderly');
    opt_state[dir].disabled = (val === 'disabled');
    opt_state[dir].adjacent = (val === 'adjacent');`;

const applyProtectReplacement = `    const val = sel.value;
    opt_state[dir].children = (val === 'children');
    opt_state[dir].elderly = (val === 'elderly');
    opt_state[dir].disabled = (val === 'disabled');
    opt_state[dir].adjacent = (val === 'adjacent');
    console.log('[DEBUG applyProtectToDir]', dir, 'sel.value=', val, 'children=', opt_state[dir].children);`;

js = js.replace(applyProtectTarget, applyProtectReplacement);

const updateUiTarget = `            const protect = document.getElementById(\`preset-protect-\${d.id}\`);
            if (protect) {
                if (opt_state[d.id].children) protect.value = 'children';
                else if (opt_state[d.id].elderly) protect.value = 'elderly';
                else if (opt_state[d.id].disabled) protect.value = 'disabled';
                else if (opt_state[d.id].adjacent) protect.value = 'adjacent';
                else protect.value = 'none';
                protect.disabled = !isActive;
            }`;

const updateUiReplacement = `            const protect = document.getElementById(\`preset-protect-\${d.id}\`);
            if (protect) {
                if (opt_state[d.id].children) protect.value = 'children';
                else if (opt_state[d.id].elderly) protect.value = 'elderly';
                else if (opt_state[d.id].disabled) protect.value = 'disabled';
                else if (opt_state[d.id].adjacent) protect.value = 'adjacent';
                else protect.value = 'none';
                protect.disabled = !isActive;
                console.log('[DEBUG updateTemplatePanelUI]', d.id, 'children=', opt_state[d.id].children, 'protect.value set to=', protect.value);
            }`;

js = js.replace(updateUiTarget, updateUiReplacement);

fs.writeFileSync(path, js);

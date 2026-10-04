const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// 1. Add 'adjacent' to getDefaultOptState
js = js.replace(
    /children: false, elderly: false, disabled: false,/g,
    'children: false, elderly: false, disabled: false, adjacent: false,'
);

// 2. Add 'adjacent' option to HTML
js = js.replace(
    /<option value="disabled">장애인<\/option>/g,
    '<option value="disabled">장애인</option>\n                        <option value="adjacent">인접</option>'
);

// 3. Add 'adjacent' to propMap for unified fields
js = js.replace(
    /\{ ped: null, aux: \{ o: 'auxB', l: '보조등우' \} \}/,
    "{ ped: { k: 'adjacent', l: '인접' }, aux: { o: 'auxB', l: '보조등우' } }"
);

// 4. Update getActiveSafety to include 'adjacent'
js = js.replace(
    /const m = \{ children: '어린이', elderly: '노인', disabled: '장애인' \};/g,
    "const m = { children: '어린이', elderly: '노인', disabled: '장애인', adjacent: '인접' };"
);

// 5. Update event listener in renderLaneFieldsUnified for auto speed down
js = js.replace(
    /if \(\['children', 'elderly', 'disabled'\]\.includes\(t\.dataset\.key\) && t\.checked\) \{/g,
    "if (['children', 'elderly', 'disabled', 'adjacent'].includes(t.dataset.key) && t.checked) {"
);

// 6. Fix applyProtectToDir to include adjacent
const oldFnRegex = /window\.applyProtectToDir = function\(dir\) \{[\s\S]*?(?=window\.applySpdToDir = function\(dir\) \{)/;
const newFn = `window.applyProtectToDir = function(dir) {
    if (!opt_state[dir]) return;
    const sel = document.getElementById(\`preset-protect-\${dir}\`);
    if (!sel) return;
    
    const val = sel.value;
    opt_state[dir].children = (val === 'children');
    opt_state[dir].elderly = (val === 'elderly');
    opt_state[dir].disabled = (val === 'disabled');
    opt_state[dir].adjacent = (val === 'adjacent');
    
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
            if (i.dataset.key === 'adjacent') i.checked = opt_state[dir].adjacent;
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

// 7. Extract block inside updateTemplatePanelUI safely
const uiTarget = `            sels.forEach(sel => {
                const cwL = document.getElementById(\`preset-cw-l-\${d.id}\`);
                const cwT = document.getElementById(\`preset-cw-t-\${d.id}\`);
                const cwR = document.getElementById(\`preset-cw-r-\${d.id}\`);
                
                if (cwL) { cwL.value = opt_state[d.id].A.CW_L || 0; cwL.disabled = !isActive; cwL.closest('td').style.opacity = isActive ? '1' : '0.4'; }
                if (cwT) { cwT.value = opt_state[d.id].A.CW || 0; cwT.disabled = !isActive; cwT.closest('td').style.opacity = isActive ? '1' : '0.4'; }
                if (cwR) { cwR.value = opt_state[d.id].A.CW_D || 0; cwR.disabled = !isActive; cwR.closest('td').style.opacity = isActive ? '1' : '0.4'; }

                const spd = document.getElementById(\`preset-spd-\${d.id}\`);
                if (spd) { spd.value = opt_state[d.id].A.SPD || 50; spd.disabled = !isActive; spd.closest('td').style.opacity = isActive ? '1' : '0.4'; }

                const protect = document.getElementById(\`preset-protect-\${d.id}\`);
                if (protect) {
                    if (opt_state[d.id].children) protect.value = 'children';
                    else if (opt_state[d.id].elderly) protect.value = 'elderly';
                    else if (opt_state[d.id].disabled) protect.value = 'disabled';
                    else protect.value = 'none';
                    protect.disabled = !isActive;
                }

                const td = sel.parentElement;
                if (isActive) {
                    if (td) td.style.opacity = '1';
                    sel.disabled = false;
                } else {
                    if (td) td.style.opacity = '0.4';
                    sel.disabled = true;
                }
            });`;

const uiReplacement = `            const cwL = document.getElementById(\`preset-cw-l-\${d.id}\`);
            const cwT = document.getElementById(\`preset-cw-t-\${d.id}\`);
            const cwR = document.getElementById(\`preset-cw-r-\${d.id}\`);
            
            if (cwL) { cwL.value = opt_state[d.id].A.CW_L || 0; cwL.disabled = !isActive; cwL.closest('td').style.opacity = isActive ? '1' : '0.4'; }
            if (cwT) { cwT.value = opt_state[d.id].A.CW || 0; cwT.disabled = !isActive; cwT.closest('td').style.opacity = isActive ? '1' : '0.4'; }
            if (cwR) { cwR.value = opt_state[d.id].A.CW_D || 0; cwR.disabled = !isActive; cwR.closest('td').style.opacity = isActive ? '1' : '0.4'; }

            const spd = document.getElementById(\`preset-spd-\${d.id}\`);
            if (spd) { spd.value = opt_state[d.id].A.SPD || 50; spd.disabled = !isActive; spd.closest('td').style.opacity = isActive ? '1' : '0.4'; }

            const protect = document.getElementById(\`preset-protect-\${d.id}\`);
            if (protect) {
                if (opt_state[d.id].children) protect.value = 'children';
                else if (opt_state[d.id].elderly) protect.value = 'elderly';
                else if (opt_state[d.id].disabled) protect.value = 'disabled';
                else if (opt_state[d.id].adjacent) protect.value = 'adjacent';
                else protect.value = 'none';
                protect.disabled = !isActive;
            }

            sels.forEach(sel => {
                const td = sel.parentElement;
                if (isActive) {
                    if (td) td.style.opacity = '1';
                    sel.disabled = false;
                } else {
                    if (td) td.style.opacity = '0.4';
                    sel.disabled = true;
                }
            });`;

if (js.includes(uiTarget)) {
    js = js.replace(uiTarget, uiReplacement);
} else {
    console.error("Could not find uiTarget in junction_optimizer.js");
}

fs.writeFileSync(path, js);
console.log('Fixed dropdown bug and added adjacent option properly');

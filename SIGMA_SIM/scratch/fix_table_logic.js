const fs = require('fs');
const path = 'SIGMA_SIM/js/table_logic.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

const target = `    // Dual 모드 아닐 때 동기화 로직
    const chkDual = document.getElementById('chk-dual-ring');
    if (chkDual && !chkDual.checked && key && key.endsWith('A')) {
        const bKey = key.replace(/A$/, 'B');
        if (target[bKey]) {
            target[bKey][idx] = val;
            const bEl = document.querySelector(\`.sigma-input[data-key="\${bKey}"][data-index="\${idx}"]\`);
            if (bEl) bEl.value = val;
        }
    }

    updateDependentCells(idx, p, sm);
    updateCycleDisplayLocally(p);
}`;

const replacement = `    // Dual 모드 아닐 때 동기화 로직
    const chkDual = document.getElementById('chk-dual-ring');
    const isDual = chkDual ? chkDual.checked : true;
    if (!isDual && key && key.endsWith('A')) {
        const bKey = key.replace(/A$/, 'B');
        if (target[bKey]) {
            target[bKey][idx] = val;
            const bEl = document.querySelector(\`.sigma-input[data-key="\${bKey}"][data-index="\${idx}"]\`);
            if (bEl) bEl.value = val;
        }
    }

    // Auto-calculate pedA and pedB
    if (['pedGreenA', 'pedFlashA', 'pedGreenB', 'pedFlashB'].includes(key)) {
        if (!sm.pedA) sm.pedA = [0,0,0,0,0,0,0,0];
        if (!sm.pedB) sm.pedB = [0,0,0,0,0,0,0,0];
        
        if (key.endsWith('A')) {
            sm.pedA[idx] = (sm.pedGreenA?.[idx] || 0) + (sm.pedFlashA?.[idx] || 0);
            const pedAEl = document.querySelector(\`.sigma-input[data-key="pedA"][data-index="\${idx}"]\`);
            if (pedAEl) pedAEl.value = sm.pedA[idx];

            if (!isDual && sm.pedB) {
                sm.pedB[idx] = (sm.pedGreenB?.[idx] || 0) + (sm.pedFlashB?.[idx] || 0);
                const pedBEl = document.querySelector(\`.sigma-input[data-key="pedB"][data-index="\${idx}"]\`);
                if (pedBEl) pedBEl.value = sm.pedB[idx];
            }
        } else {
            sm.pedB[idx] = (sm.pedGreenB?.[idx] || 0) + (sm.pedFlashB?.[idx] || 0);
            const pedBEl = document.querySelector(\`.sigma-input[data-key="pedB"][data-index="\${idx}"]\`);
            if (pedBEl) pedBEl.value = sm.pedB[idx];
        }
    }

    updateDependentCells(idx, p, sm);
    updateCycleDisplayLocally(p);
}`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replacement successful.");
} else {
    console.log("Target not found!");
}

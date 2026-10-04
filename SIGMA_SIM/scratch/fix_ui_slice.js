const fs = require('fs');
const path = '../js/junction_optimizer.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('window.updateTemplatePanelUI = function() {'));
let selsIdx = -1;
let endIdx = -1;

for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].includes('sels.forEach(sel => {')) {
        selsIdx = i;
    }
    if (selsIdx !== -1 && i > selsIdx && lines[i].includes('});')) {
        if (lines[i].trim() === '});') {
            endIdx = i;
            break;
        }
    }
}

if (startIdx !== -1 && selsIdx !== -1 && endIdx !== -1) {
    const replacement = `            const cwL = document.getElementById(\`preset-cw-l-\${d.id}\`);
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
    
    lines.splice(selsIdx, endIdx - selsIdx + 1, replacement);
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Fixed updateTemplatePanelUI successfully');
} else {
    console.error('Could not find bounds for updateTemplatePanelUI');
}

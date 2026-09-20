const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const injectCode = \
window.updateSignalMapTime = function(mapIdx, field, val) {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) return;
    const j = STATE.junctions[jid];
    if (j.signalMaps && j.signalMaps[mapIdx]) {
        j.signalMaps[mapIdx][field] = val;
    }
};
\;

if (!code.includes('window.updateSignalMapTime')) {
    code = code.replace('function copySignalMap() {', injectCode + '\\nfunction copySignalMap() {');
    fs.writeFileSync('SIGMA_SIM/js/phase.js', code);
    console.log('Restored updateSignalMapTime');
}

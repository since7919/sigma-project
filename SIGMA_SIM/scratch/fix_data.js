const fs = require('fs');
let js = fs.readFileSync('../js/data.js', 'utf8');

js = js.replace(
    /function exportSingleJunctionCSV\(jid\) \{\s*const j = STATE\.junctions\[jid\];\s*if \(\!j\) return null;/g,
    `function exportSingleJunctionCSV(jid) {\n    const j = STATE.junctions[jid];\n    if (!j) return null;\n\n    if (window.ipdInstance && jid === STATE.activeJid) {\n        const smIdx = STATE.currentSignalMapIdx || 0;\n        if (j.signalMaps && j.signalMaps[smIdx]) {\n            window.ipdInstance.saveToSignalMap(j.signalMaps[smIdx], j);\n        }\n    }`
);

fs.writeFileSync('../js/data.js', js);
console.log('Fixed exportSingleJunctionCSV with regex');

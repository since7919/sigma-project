const fs = require('fs');
let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const target = "e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'phase-tod', dayIdx, slotIdx }));";
const replacement = "e.dataTransfer.setData('application/x-sigma-tod', JSON.stringify({ type: 'phase-tod', dayIdx, slotIdx }));";

p = p.replace(target, replacement);

fs.writeFileSync('SIGMA_SIM/js/phase.js', p, 'utf8');
console.log('MIME replaced');

const fs = require('fs');
const lines = fs.readFileSync('SIGMA_SIM/index.html', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('id="info-mov-combined-container"'));
console.log(lines.slice(Math.max(0, start - 2), start + 15).join('\n'));

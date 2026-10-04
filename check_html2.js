const fs = require('fs');
const lines = fs.readFileSync('SIGMA_SIM/index.html', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('id="tab-info"'));
console.log(lines.slice(start, start + 35).join('\n'));

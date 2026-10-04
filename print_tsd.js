const fs = require('fs');
const lines = fs.readFileSync('SIGMA_SIM/index.html', 'utf8').split('\n');
const s = lines.findIndex(l => l.includes('<!-- 📊 Professional TSD Console -->'));
console.log(lines.slice(s, s+50).join('\n'));

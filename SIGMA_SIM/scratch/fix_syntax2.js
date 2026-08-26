const fs = require('fs');

let phaseCode = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// Replace \` with ` inside phase.js
phaseCode = phaseCode.replace(/\\`/g, '`');

fs.writeFileSync('SIGMA_SIM/js/phase.js', phaseCode, 'utf8');
console.log("Removed all escaped backticks");

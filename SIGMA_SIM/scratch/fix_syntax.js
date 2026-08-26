const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');
c = c.replace(/\\`A링/g, '`A링').replace(/불일치\\`/g, '불일치`').replace(/\\`B링/g, '`B링');
fs.writeFileSync('SIGMA_SIM/js/phase.js', c);
console.log("Fixed syntax error in phase.js");

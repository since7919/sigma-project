const fs = require('fs');

let code = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetStr = `const tPlans = tpPlansDict[targetTpIdx] || tpPlansDict[1] || [];`;
const replaceStr = `const tPlans = tpPlansDict[targetTpIdx] || [];`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('SIGMA_SIM/js/data_parser.js', code, 'utf8');
console.log('Modified data_parser.js to remove tpPlansDict[1] fallback during parsing.');

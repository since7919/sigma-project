const fs = require('fs');

const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/hooks/useSignalPhases.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/s\.maxTm > 0 \? s\.maxTm : s\.minTm/g, 'stepObj.maxTm > 0 ? stepObj.maxTm : stepObj.minTm');
code = code.replace(/ringTotals\[phaseConf\.ring\] \+= getPedDuration\(conf\);/g, 'ringTotals[phaseConf.ring] += getPedDuration(phaseConf);');

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed remaining references in useSignalPhases.js!');

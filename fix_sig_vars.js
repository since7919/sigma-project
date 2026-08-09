const fs = require('fs');

const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js';
let code = fs.readFileSync(file, 'utf8');

// Inside calculateCompassSignals, replace all s, l, p signal state variables with sigS, sigL, sigP
code = code.replace(/\bs = sResult\.state;/g, 'sigS = sResult.state;');
code = code.replace(/\bl = lResult\.state;/g, 'sigL = lResult.state;');
code = code.replace(/\bp = pResult\.state;/g, 'sigP = pResult.state;');

code = code.replace(/if \(stState === '녹색'\) s = 'green';/g, "if (stState === '녹색') sigS = 'green';");
code = code.replace(/else if \(stState === '황색'\) s = 'yellow';/g, "else if (stState === '황색') sigS = 'yellow';");
code = code.replace(/else s = 'red';/g, "else sigS = 'red';");

code = code.replace(/if \(ltState === '녹색'\) l = 'green';/g, "if (ltState === '녹색') sigL = 'green';");
code = code.replace(/else if \(ltState === '황색'\) l = 'yellow';/g, "else if (ltState === '황색') sigL = 'yellow';");
code = code.replace(/else l = 'red';/g, "else sigL = 'red';");

code = code.replace(/if \(pedState === '보행녹색'\) p = 'green';/g, "if (pedState === '보행녹색') sigP = 'green';");
code = code.replace(/else if \(pedState === '보행점멸'\) p = 'flash';/g, "else if (pedState === '보행점멸') sigP = 'flash';");
code = code.replace(/else p = 'red';/g, "else sigP = 'red';");

code = code.replace(/s = \(currentPhaseVal > 0 && currentPhaseVal <= 4\) \? 'yellow' : 'green';/g, "sigS = (currentPhaseVal > 0 && currentPhaseVal <= 4) ? 'yellow' : 'green';");
code = code.replace(/s = 'red';/g, "sigS = 'red';");

code = code.replace(/l = \(currentPhaseVal > 0 && currentPhaseVal <= 4\) \? 'yellow' : 'green';/g, "sigL = (currentPhaseVal > 0 && currentPhaseVal <= 4) ? 'yellow' : 'green';");
code = code.replace(/l = 'red';/g, "sigL = 'red';");

code = code.replace(/p = \(pedRemain > 0 && pedRemain <= 6\) \? 'flash' : 'green';/g, "sigP = (pedRemain > 0 && pedRemain <= 6) ? 'flash' : 'green';");
code = code.replace(/p = 'red';/g, "sigP = 'red';");

code = code.replace(/let crOn = s === 'red' \|\| l === 'red';/g, "let crOn = sigS === 'red' || sigL === 'red';");
code = code.replace(/let cyOn = s === 'yellow' \|\| l === 'yellow';/g, "let cyOn = sigS === 'yellow' || sigL === 'yellow';");
code = code.replace(/let caOn = l === 'green';/g, "let caOn = sigL === 'green';");
code = code.replace(/let cgOn = s === 'green';/g, "let cgOn = sigS === 'green';");

code = code.replace(/let prOn = p === 'red';/g, "let prOn = sigP === 'red';");
code = code.replace(/let pgOn = p === 'green' \|\| p === 'flash';/g, "let pgOn = sigP === 'green' || sigP === 'flash';");

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed s/l/p variable assignments in calculateCompassSignals!');

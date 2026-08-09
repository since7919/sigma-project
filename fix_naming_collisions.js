const fs = require('fs');

// 1. Fix signalUtils.js
const sigFile = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js';
let sigCode = fs.readFileSync(sigFile, 'utf8');

// Rename for (let s of activeSteps) to for (let stepItem of activeSteps)
sigCode = sigCode.replace(/for\s*\(\s*let\s+s\s+of\s+activeSteps\s*\)/g, 'for (let stepItem of activeSteps)');
sigCode = sigCode.replace(/isCarActive\(s\[`car\${i}`\]\)/g, 'isCarActive(stepItem[`car${i}`])');
sigCode = sigCode.replace(/isPedActive\(s\[`ped\${i}`\]\)/g, 'isPedActive(stepItem[`ped${i}`])');
sigCode = sigCode.replace(/isCarActive\(s\[`car\${conf\.idx}`\]\)/g, 'isCarActive(stepItem[`car${conf.idx}`])');

// Rename let s = 'off', l = 'off', p = 'off'; to let sigS = 'off', sigL = 'off', sigP = 'off';
sigCode = sigCode.replace(/let\s+s\s*=\s*'off',\s*l\s*=\s*'off',\s*p\s*=\s*'off';/g, "let sigS = 'off', sigL = 'off', sigP = 'off';");
sigCode = sigCode.replace(/\bs\s*=\s*([^\n;]+);/g, (match, p1) => {
  // Only replace isolated s = ... if it's setting signal status
  if (p1.includes("'G'") || p1.includes("'Y'") || p1.includes("'R'") || p1.includes("'F'") || p1.includes("matchState")) {
    return `sigS = ${p1};`;
  }
  return match;
});
sigCode = sigCode.replace(/\bl\s*=\s*([^\n;]+);/g, (match, p1) => {
  if (p1.includes("'G'") || p1.includes("'Y'") || p1.includes("'R'") || p1.includes("'F'") || p1.includes("matchState")) {
    return `sigL = ${p1};`;
  }
  return match;
});
sigCode = sigCode.replace(/\bp\s*=\s*([^\n;]+);/g, (match, p1) => {
  if (p1.includes("'G'") || p1.includes("'Y'") || p1.includes("'R'") || p1.includes("'F'") || p1.includes("matchState")) {
    return `sigP = ${p1};`;
  }
  return match;
});
sigCode = sigCode.replace(/s:\s*s,/g, 's: sigS,');
sigCode = sigCode.replace(/l:\s*l,/g, 'l: sigL,');
sigCode = sigCode.replace(/p:\s*p/g, 'p: sigP');

fs.writeFileSync(sigFile, sigCode, 'utf8');
console.log('signalUtils.js cleaned up');

// 2. Fix useSignalPhases.js
const hookFile = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/hooks/useSignalPhases.js';
let hookCode = fs.readFileSync(hookFile, 'utf8');

hookCode = hookCode.replace(/filter\(s\s*=>/g, 'filter(stepObj =>');
hookCode = hookCode.replace(/isPedActive\(s\[`ped\${conf\.idx}`\]\)/g, 'isPedActive(stepObj[`ped${conf.idx}`])');
hookCode = hookCode.replace(/isCarActive\(s\[`car\${i}`\]\)/g, 'isCarActive(stepObj[`car${i}`])');
hookCode = hookCode.replace(/reduce\(\(acc,\s*s\)\s*=>\s*acc\s*\+\s*\(s\./g, 'reduce((acc, stepObj) => acc + (stepObj.');

fs.writeFileSync(hookFile, hookCode, 'utf8');
console.log('useSignalPhases.js cleaned up');

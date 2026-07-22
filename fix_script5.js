const fs = require('fs');
const origCode = fs.readFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/true_orig_sig.js', 'utf8');
const curCode = fs.readFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', 'utf8');

function extractOrigBody(code, funcName) {
  const funcStart = 'export function ' + funcName + '(';
  const startIdx = code.indexOf(funcStart);
  let braceCount = 0;
  let bodyStart = -1, bodyEnd = -1;
  for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '{') {
      if (braceCount === 0) bodyStart = i + 1;
      braceCount++;
    } else if (code[i] === '}') {
      braceCount--;
      if (braceCount === 0) { bodyEnd = i; break; }
    }
  }
  return code.substring(bodyStart, bodyEnd);
}

const origArrow = extractOrigBody(origCode, 'calculateArrowSignals');
const origCompass = extractOrigBody(origCode, 'calculateCompassSignals');

function extractIfBlock(code, funcName) {
  const funcStart = 'export function ' + funcName + '(';
  const startIdx = code.indexOf(funcStart);
  
  const ifStartStr = 'if (updatedPhases && updatedPhases.length > 0) {';
  const ifStart = code.indexOf(ifStartStr, startIdx);
  
  let braceCount = 0;
  let ifEnd = -1;
  for (let i = ifStart + ifStartStr.length - 1; i < code.length; i++) {
    if (code[i] === '{') braceCount++;
    else if (code[i] === '}') {
      braceCount--;
      if (braceCount === 0) { ifEnd = i; break; }
    }
  }
  return code.substring(ifStart, ifEnd + 1);
}

const ifArrow = extractIfBlock(curCode, 'calculateArrowSignals');
const ifCompass = extractIfBlock(curCode, 'calculateCompassSignals');

const header = curCode.substring(0, curCode.indexOf('export function calculateArrowSignals'));

const finalArrow = `export function calculateArrowSignals({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, sigMapData, updatedPhases }) {
  ${ifArrow} else {
    ${origArrow}
  }
}`;

const finalCompass = `export function calculateCompassSignals({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, sigMapData, updatedPhases }) {
  ${ifCompass} else {
    ${origCompass}
  }
}`;

fs.writeFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', header + finalArrow + '\n\n' + finalCompass + '\n', 'utf8');
console.log('Done securely!');

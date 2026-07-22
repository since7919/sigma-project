const { execSync } = require('child_process');
const fs = require('fs');
const oldCode = execSync('git show HEAD^:SIGMA_API/sigma-frontend/src/utils/signalUtils.js').toString('utf8');
const curCode = fs.readFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', 'utf8');

const curStartArrow = curCode.indexOf('export function calculateArrowSignals');
const curEndArrow = curCode.indexOf('export function calculateCompassSignals');
const curArrowStr = curCode.substring(curStartArrow, curEndArrow);
const curCompStr = curCode.substring(curEndArrow);

const oldStartArrow = oldCode.indexOf('export function calculateArrowSignals');
const oldEndArrow = oldCode.indexOf('export function calculateCompassSignals');
const oldArrowStr = oldCode.substring(oldStartArrow, oldEndArrow);
const oldCompStr = oldCode.substring(oldEndArrow);

let newCode = curCode.substring(0, curStartArrow);

function buildCombined(funcName, curStr, oldStr, startMarker) {
  const curBody = curStr.substring(curStr.indexOf(startMarker));
  const oldBody = oldStr.substring(oldStr.indexOf(startMarker));
  
  const curBodyInner = curBody.substring(0, curBody.lastIndexOf('}'));
  const oldBodyInner = oldBody.substring(0, oldBody.lastIndexOf('}'));
  
  return `export function ${funcName}({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, sigMapData, updatedPhases }) {
  if (updatedPhases && updatedPhases.length > 0) {
    ${curBodyInner}
  } else {
    ${oldBodyInner}
  }
}
`;
}

const finalArrow = buildCombined('calculateArrowSignals', curArrowStr, oldArrowStr, 'const vehicles =');
const finalComp = buildCombined('calculateCompassSignals', curCompStr, oldCompStr, 'const directions =');

newCode += finalArrow + '\n' + finalComp;

fs.writeFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', newCode, 'utf8');
console.log('Fixed signalUtils.js!');

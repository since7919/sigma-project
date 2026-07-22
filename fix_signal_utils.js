const fs = require('fs');

const oldCode = fs.readFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/old_signalUtils.js', 'utf8');
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

// Build Arrow function
const arrowHeader = 'export function calculateArrowSignals({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, sigMapData, updatedPhases }) {\n  if (updatedPhases && updatedPhases.length > 0) {\n';
const curArrowBody = curArrowStr.substring(curArrowStr.indexOf('const vehicles = Array.from'));
const arrowMid = '  } else {\n';
const oldArrowBody = oldArrowStr.substring(oldArrowStr.indexOf('const vehicles = Array.from'));

let combinedArrow = arrowHeader + curArrowBody.replace(/}\s*$/, '  } else {\n') + oldArrowBody.replace(/}\s*$/, '  }\n}\n\n');
// The regex might be tricky, let's just do simple splits.

function buildCombined(funcName, curStr, oldStr, startMarker) {
  const curBody = curStr.substring(curStr.indexOf(startMarker));
  const oldBody = oldStr.substring(oldStr.indexOf(startMarker));
  
  // Remove trailing bracket of curBody
  const curBodyInner = curBody.substring(0, curBody.lastIndexOf('}'));
  // Remove trailing bracket of oldBody
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

fs.writeFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', newCode);
console.log('Fixed signalUtils.js!');

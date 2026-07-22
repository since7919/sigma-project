const { execSync } = require('child_process');
const fs = require('fs');

const origCode = execSync('git show 1e902e4b2cc379930994863006125cbd046ab8b2:SIGMA_API/sigma-frontend/src/utils/signalUtils.js').toString('utf8');
const curCode = fs.readFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', 'utf8');

const curStartArrow = curCode.indexOf('export function calculateArrowSignals');
const curEndArrow = curCode.indexOf('export function calculateCompassSignals');
const curArrowStr = curCode.substring(curStartArrow, curEndArrow);
const curCompStr = curCode.substring(curEndArrow);

const origStartArrow = origCode.indexOf('export function calculateArrowSignals');
const origEndArrow = origCode.indexOf('export function calculateCompassSignals');
const origArrowStr = origCode.substring(origStartArrow, origEndArrow);
const origCompStr = origCode.substring(origEndArrow);

let newCode = curCode.substring(0, curStartArrow);

function buildCombined(funcName, curStr, origStr, startMarkerCur, startMarkerOrig) {
  // Use everything up to the else { part in the current code
  const curElseMatch = curStr.match(/(\s*\} else \{\s*)/);
  if (!curElseMatch) {
    throw new Error('Could not find "} else {" in curStr');
  }
  
  const curTop = curStr.substring(0, curElseMatch.index + curElseMatch[0].length);
  
  // Get the body of origStr
  let origBody = origStr.substring(origStr.indexOf(startMarkerOrig));
  origBody = origBody.substring(0, origBody.lastIndexOf('}'));
  
  return curTop + origBody + '\n  }\n}\n';
}

// Current code starts its logic with "const vehicles =" 
// Orig code starts its logic with "const vehicles ="
let finalArrow = buildCombined('calculateArrowSignals', curArrowStr, origArrowStr, 'const vehicles =', 'const vehicles =');

// Current code starts compass logic with "const directions ="
// Orig code starts compass logic with "const directions ="
let finalComp = buildCombined('calculateCompassSignals', curCompStr, origCompStr, 'const directions =', 'const directions =');

newCode += finalArrow + '\n' + finalComp;

fs.writeFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', newCode, 'utf8');
console.log('Fixed signalUtils.js with the TRUE ORIGINAL logic!');

const fs = require('fs');

const origCode = fs.readFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/true_orig_sig.js', 'utf8');
const curCode = fs.readFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', 'utf8');

// Helper to extract function body (everything between { and })
function extractFunctionBody(code, funcName) {
  const funcStartStr = `export function ${funcName}(`;
  const startIndex = code.indexOf(funcStartStr);
  if (startIndex === -1) throw new Error(`Function ${funcName} not found`);
  
  let braceCount = 0;
  let bodyStart = -1;
  let bodyEnd = -1;
  
  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === '{') {
      if (braceCount === 0) bodyStart = i + 1;
      braceCount++;
    } else if (code[i] === '}') {
      braceCount--;
      if (braceCount === 0 && bodyStart !== -1) {
        bodyEnd = i;
        break;
      }
    }
  }
  
  if (bodyStart === -1 || bodyEnd === -1) throw new Error(`Could not parse body for ${funcName}`);
  return code.substring(bodyStart, bodyEnd);
}

const origArrowBody = extractFunctionBody(origCode, 'calculateArrowSignals');
const origCompassBody = extractFunctionBody(origCode, 'calculateCompassSignals');

const curArrowBody = extractFunctionBody(curCode, 'calculateArrowSignals');
const curCompassBody = extractFunctionBody(curCode, 'calculateCompassSignals');

// The curBody currently has an if (updatedPhases && ...) { ... } else { ... }
// We want to replace the content of the `else { ... }` block with `origBody`.
// Actually, it's easier to just recreate the function body.

function rebuildFunction(funcName, curBody, origBody) {
  // Find the end of the `if (updatedPhases && updatedPhases.length > 0) {` block
  // To do this reliably, we find "if (updatedPhases && updatedPhases.length > 0) {"
  const ifStartStr = 'if (updatedPhases && updatedPhases.length > 0) {';
  const ifStart = curBody.indexOf(ifStartStr);
  
  let braceCount = 0;
  let ifEnd = -1;
  for (let i = ifStart + ifStartStr.length - 1; i < curBody.length; i++) {
    if (curBody[i] === '{') braceCount++;
    else if (curBody[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        ifEnd = i;
        break;
      }
    }
  }
  
  const ifBlock = curBody.substring(ifStart, ifEnd + 1);
  
  return `\n${ifBlock} else {
${origBody}
  }\n`;
}

const newArrowBody = rebuildFunction('calculateArrowSignals', curArrowBody, origArrowBody);
const newCompassBody = rebuildFunction('calculateCompassSignals', curCompassBody, origCompassBody);

// Replace the functions in curCode
let newCode = curCode;

function replaceFunctionBody(code, funcName, newBody) {
  const funcStartStr = `export function ${funcName}(`;
  const startIndex = code.indexOf(funcStartStr);
  
  let braceCount = 0;
  let bodyStart = -1;
  let bodyEnd = -1;
  
  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === '{') {
      if (braceCount === 0) bodyStart = i + 1;
      braceCount++;
    } else if (code[i] === '}') {
      braceCount--;
      if (braceCount === 0 && bodyStart !== -1) {
        bodyEnd = i;
        break;
      }
    }
  }
  
  return code.substring(0, bodyStart) + newBody + code.substring(bodyEnd);
}

newCode = replaceFunctionBody(newCode, 'calculateArrowSignals', newArrowBody);
newCode = replaceFunctionBody(newCode, 'calculateCompassSignals', newCompassBody);

fs.writeFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', newCode, 'utf8');
console.log('Successfully rebuilt signalUtils.js');

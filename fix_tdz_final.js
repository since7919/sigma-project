const fs = require('fs');

const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/hooks/useSignalPhases.js';
let code = fs.readFileSync(file, 'utf8');

// We find:
// let currStep = currentPhaseIdx;
// or
// let step = currentPhaseIdx;
// And then replace step with currStep in that loop
const targetStr1 = 'let currStep = currentPhaseIdx;';
const targetStr2 = 'let step = currentPhaseIdx;';

let idx = code.indexOf(targetStr1);
if (idx === -1) {
  idx = code.indexOf(targetStr2);
}

if (idx !== -1) {
  // Let's replace 'let step/currStep' and the while loop that follows it
  // We can just grab the block of 300 characters
  let block = code.slice(idx, idx + 300);
  block = block.replace('let step =', 'let currStep =');
  // replace \bstep\b with currStep
  block = block.replace(/\bstep\b/g, 'currStep');
  
  code = code.slice(0, idx) + block + code.slice(idx + 300);
  fs.writeFileSync(file, code, 'utf8');
  console.log('Fixed loop variables!');
} else {
  console.log('Not found!');
}

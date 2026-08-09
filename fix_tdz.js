const fs = require('fs');

const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/hooks/useSignalPhases.js';
let code = fs.readFileSync(file, 'utf8');

// Replace the specific block of step inside the while loop
code = code.replace(
  `                  let step = currentPhaseIdx;
                  let loopCount = 0;
                  while (step !== targetIdx && loopCount < 8) {
                    step = (step % 8) + 1;
                    if (step === targetIdx) break;
                    const split = cropData[\`\${ringPrefix}_\${step}_PHASE_VAL\`] || 0;
                    sumTime += split;
                    loopCount++;
                  }`,
  `                  let currStep = currentPhaseIdx;
                  let loopCount = 0;
                  while (currStep !== targetIdx && loopCount < 8) {
                    currStep = (currStep % 8) + 1;
                    if (currStep === targetIdx) break;
                    const split = cropData[\`\${ringPrefix}_\${currStep}_PHASE_VAL\`] || 0;
                    sumTime += split;
                    loopCount++;
                  }`
);

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed step hoisting bug in useSignalPhases.js');

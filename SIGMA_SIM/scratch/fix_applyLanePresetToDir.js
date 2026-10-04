const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

js = js.replace(
    /const lanes = \{ L: 0, T: 0, R: 0, U: 0, C: 0, TL: 0, TR: 0 \};/g,
    "const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, C_LT: 0, C_TR: 0, LU: 0, LT: 0, TR: 0, LR: 0, R_D: 0 };"
);

fs.writeFileSync(path, js);
console.log('Fixed applyLanePresetToDir lanes');

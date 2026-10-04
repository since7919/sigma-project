const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

js = js.replace(
    /\['L', 'T', 'R', 'U', 'C', 'LU', 'LT', 'TR', 'LR', 'R_D'\].forEach\(k => opt_state\[dir\]\.A\[k\] = 0\);/g,
    "Object.keys(lanes).forEach(k => opt_state[dir].A[k] = 0);"
);

fs.writeFileSync(path, js);
console.log('Fixed hardcoded array in applyLanePresetComposite');

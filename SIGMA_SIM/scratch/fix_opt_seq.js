const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

js = js.replace(
    /const OPT_SEQ = \[\n\s*\{ c: 'A', t: 'C', g: null \}, \{ c: 'B', t: 'C', g: null \},/g,
    "const OPT_SEQ = [\n    { c: 'A', t: 'C', g: null }, { c: 'B', t: 'C', g: null },\n    { c: 'A', t: 'C_LT', g: null }, { c: 'B', t: 'C_LT', g: null },\n    { c: 'A', t: 'C_TR', g: null }, { c: 'B', t: 'C_TR', g: null },"
);

fs.writeFileSync(path, js);
console.log('Fixed OPT_SEQ to include C_LT and C_TR');

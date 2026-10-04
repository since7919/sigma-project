const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

const target = "    { c: 'A', t: 'C', g: null }, { c: 'B', t: 'C', g: null },";
const replacement = "    { c: 'A', t: 'C', g: null }, { c: 'B', t: 'C', g: null },\n    { c: 'A', t: 'C_LT', g: null }, { c: 'B', t: 'C_LT', g: null },\n    { c: 'A', t: 'C_TR', g: null }, { c: 'B', t: 'C_TR', g: null },";

if (js.includes(target)) {
    js = js.replace(target, replacement);
    fs.writeFileSync(path, js);
    console.log('Fixed OPT_SEQ using literal replacement');
} else {
    console.log('Target string not found in OPT_SEQ');
}

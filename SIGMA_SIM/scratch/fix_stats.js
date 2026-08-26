const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/stats.js', 'utf8');

const oldStr = `function _parseCsvLine(line) {
    const result = [];`;

const newStr = `function _parseCsvLine(line) {
    if (line.indexOf('"') === -1) {
        return line.split(',').map(s => s.trim());
    }
    const result = [];`;

code = code.replace(oldStr, newStr);

fs.writeFileSync('SIGMA_SIM/js/stats.js', code, 'utf8');
console.log("Fixed stats.js");

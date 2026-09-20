const fs = require('fs');

function getFuncs(path) {
    const lines = fs.readFileSync(path, 'utf8').split('\n');
    const funcs = [];
    lines.forEach(l => {
        const match = l.match(/^(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/);
        if (match) funcs.push(match[1]);
    });
    return funcs;
}

const dFuncs = getFuncs('SIGMA_SIM/js/data.js');
const dpFuncs = getFuncs('SIGMA_SIM/js/data_parser.js');

console.log('Only in data.js:', dFuncs.filter(f => !dpFuncs.includes(f)));
console.log('Only in data_parser.js:', dpFuncs.filter(f => !dFuncs.includes(f)));

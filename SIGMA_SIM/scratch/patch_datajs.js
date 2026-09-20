const fs = require('fs');
const path = 'SIGMA_SIM/js/data.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('async function handleExcelSignalLoad'));
if (startIdx !== -1) {
    let braces = 0;
    let capture = false;
    let endIdx = startIdx;
    for (let i = startIdx; i < lines.length; i++) {
        braces += (lines[i].match(/\{/g) || []).length;
        braces -= (lines[i].match(/\}/g) || []).length;
        capture = true;
        if (capture && braces <= 0) {
            endIdx = i;
            break;
        }
    }
    
    // Replace with a comment
    lines.splice(startIdx, endIdx - startIdx + 1, '// Removed handleExcelSignalLoad duplicate from data.js. Use data_parser.js instead.');
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Successfully removed duplicate function from data.js');
} else {
    console.log('Could not find function in data.js');
}

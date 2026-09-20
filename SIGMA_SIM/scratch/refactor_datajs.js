const fs = require('fs');

const path = 'SIGMA_SIM/js/data.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const funcsToRemove = [
    'createEmptySignalMap', 'serializeFlash', 'serializeOpInt', 'serializeArrows',
    'processIntersectionCSV', 'processSignalMapCSV', 'processTodPlanCSV', 'parseCSV',
    'processGeoJSON', 'processBoundaryGeoJSON', 'parseExtraConfigs'
];

let i = 0;
while (i < lines.length) {
    let match = lines[i].match(/^(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/);
    if (match && funcsToRemove.includes(match[1])) {
        const funcName = match[1];
        let startIdx = i;
        let braces = 0;
        let capture = false;
        let endIdx = startIdx;
        
        for (let j = startIdx; j < lines.length; j++) {
            braces += (lines[j].match(/\{/g) || []).length;
            braces -= (lines[j].match(/\}/g) || []).length;
            capture = true;
            if (capture && braces <= 0) {
                endIdx = j;
                break;
            }
        }
        
        console.log('Removing ' + funcName + ' from line ' + startIdx + ' to ' + endIdx);
        lines.splice(startIdx, endIdx - startIdx + 1);
    } else {
        i++;
    }
}

fs.writeFileSync(path, lines.join('\n'));
console.log('Successfully refactored data.js');

const fs = require('fs');

function getFuncBody(path, funcName) {
    const lines = fs.readFileSync(path, 'utf8').split('\n');
    const startIdx = lines.findIndex(l => l.match(new RegExp('^(?:async\\\\s+)?function\\\\s+' + funcName + '\\\\s*\\\\(')));
    if (startIdx === -1) return null;
    let braces = 0;
    let capture = false;
    let endIdx = startIdx;
    for (let i = startIdx; i < lines.length; i++) {
        braces += (lines[i].match(/\\{/g) || []).length;
        braces -= (lines[i].match(/\\}/g) || []).length;
        capture = true;
        if (capture && braces <= 0) {
            endIdx = i;
            break;
        }
    }
    return lines.slice(startIdx, endIdx + 1).join('\n');
}

const dupes = [
    'createEmptySignalMap', 'serializeFlash', 'serializeOpInt', 'serializeArrows',
    'processIntersectionCSV', 'processSignalMapCSV', 'processTodPlanCSV', 'parseCSV',
    'processGeoJSON', 'processBoundaryGeoJSON', 'parseExtraConfigs'
];

dupes.forEach(f => {
    const dp = getFuncBody('SIGMA_SIM/js/data_parser.js', f);
    const d = getFuncBody('SIGMA_SIM/js/data.js', f);
    if (dp && d) {
        if (dp !== d) {
            console.log(f + ' is DIFFERENT');
        } else {
            console.log(f + ' is IDENTICAL');
        }
    } else {
        console.log('Error reading ' + f);
    }
});

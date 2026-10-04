const fs = require('fs');
let js = fs.readFileSync('../js/stats.js', 'utf8');

const regex = /if\s*\(j\.signalMaps\)\s*\{\s*j\.signalMaps\.forEach\(sm\s*=>\s*\{\s*if\s*\(sm\s*&&\s*sm\.ipdCustomArrows\)\s*\{\s*let\s*protLefts\s*=\s*new\s*Set\(\);\s*let\s*unprotLefts\s*=\s*new\s*Set\(\);\s*Object\.values\(sm\.ipdCustomArrows\)\.forEach\(arr\s*=>\s*\{[\s\S]*?hasLeftUnprot\s*=\s*true;\s*\}\);\s*\}\s*\}\);\s*\}/;

const helperCode = `
    const IPD_MAP = {
        1: ['WBL'], 2: ['EBT'], 3: ['NBL'], 4: ['SBT'],
        5: ['EBL'], 6: ['WBT'], 7: ['SBL'], 8: ['NBT'],
        9: ['NEL'], 10: ['SWT'], 11: ['SEL'], 12: ['NWT'],
        13: ['SWL'], 14: ['NET'], 15: ['NWL'], 16: ['SET'],
        22: ['EBR'], 24: ['SBR'], 26: ['WBR'], 28: ['NBR'],
        30: ['SWR'], 32: ['NWR'], 34: ['NER'], 36: ['SER'],
        31: ['WBL-P'], 33: ['NBL-P'], 35: ['EBL-P'], 37: ['SBL-P'],
        39: ['NEL-P'], 41: ['SEL-P'], 43: ['SWL-P'], 45: ['NWL-P'],
        102: ['PED-S'], 104: ['PED-W'], 106: ['PED-N'], 108: ['PED-E'],
        101: ['PED-NWSE'], 103: ['PED-NESW'],
        112: ['PED-NW'], 113: ['PED-SW'], 114: ['PED-NE'], 116: ['PED-SE'],
        118: ['PED-NWSE', 'PED-NESW']
    };

    const getArrowsFromSignalMap = (sm) => {
        if (sm.ipdCustomArrows) {
            let all = [];
            Object.values(sm.ipdCustomArrows).forEach(arr => {
                if (Array.isArray(arr)) all.push(...arr);
            });
            return all;
        }
        let all = [];
        const mapMov = (m) => IPD_MAP[m] || [];
        for (let i = 0; i < 8; i++) {
            if (sm.movA && sm.movA[i]) all.push(...mapMov(sm.movA[i]));
            if (sm.movB && sm.movB[i]) all.push(...mapMov(sm.movB[i]));
            if (sm.pedMovA && sm.pedMovA[i]) all.push(...mapMov(sm.pedMovA[i]));
            if (sm.pedMovB && sm.pedMovB[i]) all.push(...mapMov(sm.pedMovB[i]));
        }
        return all;
    };
`;

const replacement = `if (j.signalMaps) {
            j.signalMaps.forEach(sm => {
                if (sm) {
                    let protLefts = new Set();
                    let unprotLefts = new Set();
                    
                    const arrows = getArrowsFromSignalMap(sm);
                    arrows.forEach(a => {
                        if (a === 'PED-NWSE' || a === 'PED-NESW') hasDiagonal = true;
                        else if (a.endsWith('L')) protLefts.add(a.replace('L', ''));
                        else if (a.endsWith('L-P')) unprotLefts.add(a.replace('L-P', ''));
                        else if (a.endsWith('R')) hasRightSig = true;
                    });
                    
                    protLefts.forEach(dir => {
                        if (unprotLefts.has(dir)) hasPplt = true;
                        else hasLeftProt = true;
                    });
                    unprotLefts.forEach(dir => {
                        if (!protLefts.has(dir)) hasLeftUnprot = true;
                    });
                }
            });
        }`;

// We need to insert helperCode right before junctions.forEach(j => {
const insertPoint = 'junctions.forEach(j => {';

if (!js.includes(insertPoint)) {
    console.log("Could not find insert point!");
} else if (!regex.test(js)) {
    console.log("Regex not found!");
} else {
    js = js.replace(insertPoint, helperCode + '\n    ' + insertPoint);
    js = js.replace(regex, replacement);
    fs.writeFileSync('../js/stats.js', js);
    console.log("Patched stats.js for unedited junctions");
}

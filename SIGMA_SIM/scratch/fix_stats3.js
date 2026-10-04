const fs = require('fs');
let js = fs.readFileSync('../js/stats.js', 'utf8');

const regex = /if\s*\(j\.optimizerState\)\s*\{[\s\S]*?Object\.values\(j\.optimizerState\)\.forEach\(opt\s*=>\s*\{[\s\S]*?if\s*\(opt\.diagonal\)\s*hasDiagonal\s*=\s*true;[\s\S]*?if\s*\(sm\s*&&\s*sm\.ipdCustomArrows\)\s*\{[\s\S]*?hasDiagonal\s*=\s*true;[\s\S]*?\}\s*\);[\s\S]*?\}\s*\);\s*\}/;

const replacement = `if (j.optimizerState) {
            Object.values(j.optimizerState).forEach(opt => {
                if (opt.children) hasChildren = true;
                if (opt.elderly) hasElderly = true;
                if (opt.op) {
                    if (opt.op.pedLpi) hasLpi = true;
                    if (opt.op.pedEarly) hasPedEarly = true;
                }
            });
        }
        
        if (j.signalMaps) {
            j.signalMaps.forEach(sm => {
                if (sm && sm.ipdCustomArrows) {
                    let protLefts = new Set();
                    let unprotLefts = new Set();
                    
                    Object.values(sm.ipdCustomArrows).forEach(arr => {
                        if (!Array.isArray(arr)) return;
                        arr.forEach(a => {
                            if (a === 'PED-NWSE' || a === 'PED-NESW') hasDiagonal = true;
                            else if (a.endsWith('L')) protLefts.add(a.replace('L', ''));
                            else if (a.endsWith('L-P')) unprotLefts.add(a.replace('L-P', ''));
                            else if (a.endsWith('R')) hasRightSig = true;
                        });
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

if (!regex.test(js)) {
    console.log("Regex not found!");
} else {
    js = js.replace(regex, replacement);
    fs.writeFileSync('../js/stats.js', js);
    console.log("Patched stats.js using regex");
}

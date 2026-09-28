const fs = require('fs');
let js = fs.readFileSync('../js/stats.js', 'utf8');

const search = '        if (hasLeftProt) cntLeftProt++;';
const replacement = `        if (j.signalMaps) {
            j.signalMaps.forEach(sm => {
                if (sm && sm.ipdCustomArrows) {
                    Object.values(sm.ipdCustomArrows).forEach(arr => {
                        if (arr.includes('PED-NWSE') || arr.includes('PED-NESW')) {
                            hasDiagonal = true;
                        }
                    });
                }
            });
        }

        if (hasLeftProt) cntLeftProt++;`;

js = js.replace(search, replacement);
fs.writeFileSync('../js/stats.js', js);
console.log("Patched stats.js");

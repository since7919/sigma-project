const fs = require('fs');
let js = fs.readFileSync('../js/stats.js', 'utf8');

const regexMap = /^\s*const IPD_MAP = \{[\s\S]*?return all;\s*\};/m;
const match = js.match(regexMap);
if (match) {
    js = js.replace(match[0], ''); // remove from wrong place
    
    const correctAnchor = '    let cntRightSig = 0, cntDiagonal = 0, cntLpi = 0;';
    if (js.includes(correctAnchor)) {
        js = js.replace(correctAnchor, match[0] + '\n' + correctAnchor);
        fs.writeFileSync('../js/stats.js', js);
        console.log("Moved IPD_MAP and helper to correct place");
    } else {
        console.log("Anchor not found");
    }
} else {
    console.log("IPD_MAP not found");
}

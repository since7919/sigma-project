const fs = require('fs');

let js = fs.readFileSync('../js/stats.js', 'utf8');

// Remove the old pct definition
js = js.replace(/const pct = \(val\) => totalJunctions > 0 \? \(val \/ totalJunctions \* 100\)\.toFixed\(1\) : "0\.0";\n/, '');
// Sometimes it's slightly different formatting, so let's use a simpler regex
js = js.replace(/    const pct = \(val\) => totalJunctions > 0 \? \(val \/ totalJunctions \* 100\)\.toFixed\(1\) : "0\.0";\n/g, '');

// Insert it before the section starts
const anchor = `    // 2. 카테고리 1: 기본 통계 및 주기`;
const injection = `    const pct = (val) => totalJunctions > 0 ? (val / totalJunctions * 100).toFixed(1) : "0.0";\n\n    // 2. 카테고리 1: 기본 통계 및 주기`;

if (js.includes(anchor)) {
    js = js.replace(anchor, injection);
    fs.writeFileSync('../js/stats.js', js);
    console.log("Fixed pct reference error.");
} else {
    console.log("Anchor not found.");
}

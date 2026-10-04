const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// 1. Update OPT_TYPES
js = js.replace(
    /const OPT_TYPES = \{ C: '중앙차로', U: '유턴',/,
    "const OPT_TYPES = { C: '중앙차로', C_LT: '중앙_직좌', C_TR: '중앙_직우', U: '유턴',"
);

// 2. Update default state in A and B
js = js.replace(
    /A: \{ C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 1,/g,
    "A: { C: 0, C_LT: 0, C_TR: 0, U: 0, LU: 0, L: 0, LT: 0, T: 1,"
);
js = js.replace(
    /B: \{ C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 0,/g,
    "B: { C: 0, C_LT: 0, C_TR: 0, U: 0, LU: 0, L: 0, LT: 0, T: 0,"
);

// 3. Update applyLanePresetComposite lanes
js = js.replace(
    /const lanes = \{ L: 0, T: 0, R: 0, U: 0, C: 0, LU: 0, LT: 0, TR: 0, LR: 0, R_D: 0 \};/g,
    "const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, C_LT: 0, C_TR: 0, LU: 0, LT: 0, TR: 0, LR: 0, R_D: 0 };"
);

// 4. Update applyLanePreset lanes
js = js.replace(
    /const lanes = \{ L: 0, T: 0, R: 0, U: 0, C: 0, LU: 0, LT: 0, TR: 0, LR: 0 \};/g,
    "const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, C_LT: 0, C_TR: 0, LU: 0, LT: 0, TR: 0, LR: 0 };"
);

// 5. Update renderOptimizer logic for centralRows
js = js.replace(
    /if \(m\.t === 'C'\) centralRows\+\+;/g,
    "if (m.t === 'C' || m.t === 'C_LT' || m.t === 'C_TR') centralRows++;"
);

// 6. Update charMap and remove 'C' exclusion from drawing arrows
// Old: const charMap = { T: "↑", L: "↰", R: "↱", U: "↶", LU: ["↰", "↶"], LT: ["↑", "↰"], TR: ["↱", "↑"], LR: ["↰", "↱"], CW: "🚶", SPD: "V" };
// Old logic: if (m.t !== 'C' && m.t !== 'CW_D') {
js = js.replace(
    /const charMap = \{ T: "↑", L: "↰", R: "↱", U: "↶", LU: \["↰", "↶"\], LT: \["↑", "↰"\], TR: \["↱", "↑"\], LR: \["↰", "↱"\], CW: "🚶", SPD: "V" \};/g,
    'const charMap = { T: "↑", L: "↰", R: "↱", U: "↶", LU: ["↶", "↰"], LT: ["↰", "↑"], TR: ["↑", "↱"], LR: ["↰", "↱"], C: "↑", C_LT: ["↰", "↑"], C_TR: ["↑", "↱"], CW: "🚶", SPD: "V" };'
);

js = js.replace(
    /if \(m\.t !== 'C' && m\.t !== 'CW_D'\) \{/g,
    "if (m.t !== 'CW_D') {"
);

// 7. Update fill and textContent for C
// fill: (m.t === 'C' ? '#3498db' : (isSafety ? '#f1c40f' : '#ffffff')),
js = js.replace(
    /fill: \(m\.t === 'C' \? '#3498db'/g,
    "fill: ((m.t === 'C' || m.t === 'C_LT' || m.t === 'C_TR') ? '#3498db'"
);

// num.textContent = isGhost ? "+" : (m.t === 'C' ? `C${count}` : count);
js = js.replace(
    /num\.textContent = isGhost \? "\+" : \(m\.t === 'C' \? `C\$\{count\}` : count\);/g,
    'num.textContent = isGhost ? "+" : ((m.t === "C" || m.t === "C_LT" || m.t === "C_TR") ? `C${count}` : count);'
);

// 8. Update options in preset-bus dropdown
// <option value="C1">🚌</option>
// <option value="C2">🚌🚌</option>
js = js.replace(
    /<option value="C1">🚌<\/option>\s*<option value="C2">🚌🚌<\/option>/,
    '<option value="C_LT1">[↰↑]</option>\n                    <option value="C1">↑</option>\n                    <option value="C_TR1">[↑↱]</option>'
);

fs.writeFileSync(path, js);
console.log('Fixed SVG charMap and added bus lane options');

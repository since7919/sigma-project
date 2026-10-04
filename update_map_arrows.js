const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

// 1. Extract mapMovSet
const regexLogic = /const pMovA = sm\.pedMovA \|\| \[0, 0, 0, 0, 0, 0, 0, 0\];\s*const pMovB = sm\.pedMovB \|\| \[0, 0, 0, 0, 0, 0, 0, 0\];\s*const pedSet = new Set\(\[\.\.\.pMovA, \.\.\.pMovB\]\.filter\(x => x > 0\)\);\s*\/\/\s*\[개량\] 편집 모드에서는 데이터 유무와 상관없이 1~16\(차량\) 및 101~116\(보행\) 화살표를 전수 노출\s*let allMovs;\s*if \(isEditingMode\) \{\s*const vehicleRange = Array\.from\(\{ length: 16 \}, \(_, i\) => i \+ 1\);\s*const pedRange = Array\.from\(\{ length: 16 \}, \(_, i\) => i \+ 101\);\s*const configuredMovs = Object\.keys\(j\.arrowConfigs \|\| \{\}\)\.map\(Number\);\s*const mapMovs = \[\.\.\.\(sm\.movA \|\| \[\]\), \.\.\.\(sm\.movB \|\| \[\]\), \.\.\.pMovA, \.\.\.pMovB\]\.map\(Number\);\s*allMovs = \[\.\.\.new Set\(\[\.\.\.mapMovs, \.\.\.configuredMovs, \.\.\.vehicleRange, \.\.\.pedRange\]\)\]\.filter\(m => m > 0\);\s*\} else \{\s*\/\/ 일반 등화 모드: 무브먼트가 기록된\(메모리 관리용\) 화살표만 나타남\s*const mapMovs = \[\.\.\.\(sm\.movA \|\| \[\]\), \.\.\.\(sm\.movB \|\| \[\]\), \.\.\.pMovA, \.\.\.pMovB\]\.map\(Number\);\s*allMovs = \[\.\.\.new Set\(mapMovs\)\]\.filter\(m => m > 0\);\s*\}/;

const newLogic = `const pMovA = sm.pedMovA || [0, 0, 0, 0, 0, 0, 0, 0];
    const pMovB = sm.pedMovB || [0, 0, 0, 0, 0, 0, 0, 0];
    const pedSet = new Set([...pMovA, ...pMovB].filter(x => x > 0));
    const activeMapMovs = new Set([...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number).filter(x => x > 0));

    // [개량] 편집 모드에서는 데이터 유무와 상관없이 1~16(차량) 및 101~116(보행) 화살표를 전수 노출
    let allMovs;
    if (isEditingMode) {
        const vehicleRange = Array.from({ length: 16 }, (_, i) => i + 1); // 1-16
        const pedRange = Array.from({ length: 16 }, (_, i) => i + 101); // 101-116
        const configuredMovs = Object.keys(j.arrowConfigs || {}).map(Number);
        allMovs = [...new Set([...activeMapMovs, ...configuredMovs, ...vehicleRange, ...pedRange])].filter(m => m > 0);
    } else {
        // 일반 등화 모드: 무브먼트가 기록된(메모리 관리용) 화살표만 나타남
        allMovs = [...activeMapMovs];
    }`;

let replaced = c.replace(regexLogic, newLogic);
if (c !== replaced) {
    console.log("Logic replaced.");
    c = replaced;
} else {
    console.log("Regex for logic failed.");
}

// 2. Modify color logic
const regexColor = /const isFocused = STATE\.focusedArrow && STATE\.focusedArrow\.jid === jid && STATE\.focusedArrow\.m === m && STATE\.focusedArrow\.idx === idx;\s*const labelHtml = isEditing \? `<div class="mov-num-label">\$\{m\}<\/div>` : '';\s*const icon = L\.divIcon\(\{\s*className: 'signal-arrow-container',\s*html: `\s*<div id="icon-\$\{jid\}-\$\{m\}-\$\{idx\}" class="signal-arrow R \$\{walkCls\} \$\{isEditing \? 'editing' : ''\} \$\{isFocused \? 'focused' : ''\}"/;

const newColor = `const isFocused = STATE.focusedArrow && STATE.focusedArrow.jid === jid && STATE.focusedArrow.m === m && STATE.focusedArrow.idx === idx;
            const isUsedMov = activeMapMovs.has(m);
            const defaultColor = (isEditingMode && isUsedMov) ? 'G' : 'R';

            const labelHtml = isEditing ? \`<div class="mov-num-label">\${m}</div>\` : '';

            const icon = L.divIcon({
                className: 'signal-arrow-container',
                html: \`
                    <div id="icon-\${jid}-\${m}-\${idx}" class="signal-arrow \${defaultColor} \${walkCls} \${isEditing ? 'editing' : ''} \${isFocused ? 'focused' : ''}"`;

replaced = c.replace(regexColor, newColor);
if (c !== replaced) {
    console.log("Color logic replaced.");
    c = replaced;
} else {
    console.log("Regex for color failed.");
}

fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c, 'utf8');

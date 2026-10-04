const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

const regexLogic = /const pedSet = new Set\(\[\.\.\.pMovA, \.\.\.pMovB\]\.filter\(x => x > 0\)\);\s*\/\/\s*\[개량\] 편집 모드에서는 데이터 유무와 상관없이 1~16\(차량\) 및 101~116\(보행\) 화살표를 전수 노출\s*let allMovs;\s*if \(isEditingMode\) \{\s*const vehicleRange = Array\.from\(\{ length: 16 \}, \(_, i\) => i \+ 1\);\s*const pedRange = Array\.from\(\{ length: 16 \}, \(_, i\) => i \+ 101\);\s*const configuredMovs = Object\.keys\(j\.arrowConfigs \|\| \{\}\)\.map\(Number\);\s*const mapMovs = \[\.\.\.\(sm\.movA \|\| \[\]\), \.\.\.\(sm\.movB \|\| \[\]\), \.\.\.pMovA, \.\.\.pMovB\]\.map\(Number\);\s*allMovs = \[\.\.\.new Set\(\[\.\.\.mapMovs, \.\.\.configuredMovs, \.\.\.vehicleRange, \.\.\.pedRange\]\)\]\.filter\(m => m > 0\);\s*\} else \{\s*\/\/ 일반 등화 모드: 무브먼트가 기록된\(메모리 관리용\) 화살표만 나타남\s*const mapMovs = \[\.\.\.\(sm\.movA \|\| \[\]\), \.\.\.\(sm\.movB \|\| \[\]\), \.\.\.pMovA, \.\.\.pMovB\]\.map\(Number\);\s*allMovs = \[\.\.\.new Set\(mapMovs\)\]\.filter\(m => m > 0\);\s*\}/;

const newLogic = `const pedSet = new Set([...pMovA, ...pMovB].filter(x => x > 0));
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
    fs.writeFileSync('SIGMA_SIM/js/junction_map.js', replaced, 'utf8');
    console.log("Logic replaced successfully.");
} else {
    console.log("Regex still failed.");
}

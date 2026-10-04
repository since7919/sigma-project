const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

const targetStr = `const pedSet = new Set([...pMovA, ...pMovB].filter(x => x > 0));

    // [개량] 편집 모드에서는 데이터 유무와 상관없이 1~16(차량) 및 101~116(보행) 화살표를 전수 노출
    let allMovs;
    if (isEditingMode) {
        const vehicleRange = Array.from({ length: 16 }, (_, i) => i + 1); // 1-16
        const pedRange = Array.from({ length: 16 }, (_, i) => i + 101); // 101-116
        const configuredMovs = Object.keys(j.arrowConfigs || {}).map(Number);
        const mapMovs = [...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number);
        allMovs = [...new Set([...mapMovs, ...configuredMovs, ...vehicleRange, ...pedRange])].filter(m => m > 0);
    } else {
        // 일반 등화 모드: 무브먼트가 기록된(메모리 관리용) 화살표만 나타남
        const mapMovs = [...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number);
        allMovs = [...new Set(mapMovs)].filter(m => m > 0);
    }`;

const newStr = `const pedSet = new Set([...pMovA, ...pMovB].filter(x => x > 0));
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

c = c.replace(targetStr, newStr);
c = c.replace(targetStr.replace(/\r\n/g, '\n'), newStr);

fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c, 'utf8');
console.log("Replaced with split/join");

const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const marker = "// [3] 일계획 및 시간계획 분석 (1-indexed getVal 오프셋 및 동적 컬럼 탐색 적용)";
const p1 = code.indexOf(marker);
const p2 = code.indexOf(marker, p1 + 1);

if (p1 !== -1 && p2 !== -1) {
    code = code.substring(0, p1) + code.substring(p2);
    fs.writeFileSync('SIGMA_SIM/js/data_parser.js', code, 'utf8');
    console.log("SUCCESSFULLY REMOVED DUPLICATE");
} else {
    console.log("FAILED", p1, p2);
}

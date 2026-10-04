const fs = require('fs');

let code = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetStr = `
                        if (!pl) return existingPlan;
`;

const replaceStr = `
                        // [수정] 엑셀에 데이터가 없으면 기존 값을 유지하는게 아니라 공란으로 덮어써서 비워야 함.
                        if (!pl) return { cycle: 0, offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
`;

code = code.replace(targetStr.trim(), replaceStr.trim());

fs.writeFileSync('SIGMA_SIM/js/data_parser.js', code, 'utf8');
console.log('Modified data_parser.js successfully.');

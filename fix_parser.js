const fs = require('fs');

let code = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetStr = `
                        // 엑셀에서 읽어온 패턴의 splitA 합계가 0이면 비어있는 것으로 간주하고 기존 데이터 유지 (덮어쓰기 방지)
                        const sumA = pl.splitA ? pl.splitA.reduce((a,b)=>a+b, 0) : 0;
                        if (sumA === 0 && existingPlan.splitA && existingPlan.splitA.reduce((a,b)=>a+b,0) > 0) {
                            return existingPlan;
                        }
`;

const replaceStr = `
                        // [수정] 사용자의 요청: 엑셀에서 빈칸(합계 0)인 경우 앱에서도 공란으로 덮어써서 우회 로직이 동작하도록 함.
                        const sumA = pl.splitA ? pl.splitA.reduce((a,b)=>a+b, 0) : 0;
                        if (sumA === 0) {
                            // 빈 플랜으로 덮어씌움
                            return { cycle: 0, offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
                        }
`;

// wait, the previous code had `return { cycle: pl.cycle || existingPlan.cycle, offset: pl.offset !== undefined ? pl.offset : existingPlan.offset, splitA: [...pl.splitA], splitB: [...pl.splitB] };` after this.
// If it's empty, we return 0s so that it's clearly empty!

code = code.replace(targetStr.trim(), replaceStr.trim());

fs.writeFileSync('SIGMA_SIM/js/data_parser.js', code, 'utf8');
console.log('Modified data_parser.js successfully.');

const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const regex1 = /\/\/ \[2\] 먼? 시그널맵의 기?[\s\S]*?const rawSteps\s*=\s*\[\];/;

const replace1 = `// [2] 시그널맵 분석 엔진 (사용자 규칙 기반)
            // 사용자 확인: 엑셀에서 시그널맵의 행(Row) 위치와 열(Column) 위치는 항상 고정입니다.
            // 단, 병합된 셀(Merged Cells)이나 숨겨진 열로 인해 실제 값이 들어있는 컬럼 인덱스가 1~2칸 차이날 수 있으므로,
            // 주변 컬럼을 함께 검사하여 값을 추출합니다.
            const baseRowMapStart = 247;
            
            // 행(Row) 밀림 보정값 (기본 위치인 247행 기준이므로 0)
            const rMovA = 5;
            const rMovB = 12;

            // [1] 이동류(Movement) ID 추출 (보정된 행 사용)
            const baseMovA = [], baseMovB = [];
            for (let c = 19; c <= 54; c += 5) {
                // 값이 병합되어 c+1 에 있을 수도 있으므로 확인
                let vA = getVal(rMovA, c); if (vA === null || String(vA).trim() === "") vA = getVal(rMovA, c + 1);
                let vB = getVal(rMovB, c); if (vB === null || String(vB).trim() === "") vB = getVal(rMovB, c + 1);
                baseMovA.push(parseInt(vA) || 0);
                baseMovB.push(parseInt(vB) || 0);
            }

            // 병합/숨김 열 대비 안전한 값 추출 함수
            const getSafeVal = (r, cStart, cEnd) => {
                for (let c = cStart; c <= cEnd; c++) {
                    const v = getVal(r, c);
                    if (v !== null && String(v).trim() !== "") return v;
                }
                return "";
            };

            const minCol = 53, maxCol = 55, eopCol = 57; // 기본값 (기존 넓은 양식)
            const lsuCols = Array(8).fill(null).map((_, i) => ({ v: 5 + i * 6, p: 8 + i * 6 }));

            // [3] 시그널맵 분석 엔진
            const processRingData = (startRow, baseMovs, eopSourceRow = null) => {
                const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0 }));
                const rawSteps = [];`;

content = content.replace(regex1, replace1);

const regex2 = /const minStr = String\(getVal\(r, minCol\) \|\| ""\)\.trim\(\);\s*const eopStr = String\(getVal\(eopRow, eopCol\) \|\| ""\)\.toUpperCase\(\)\.trim\(\);/;
const replace2 = `const minStr = String(getSafeVal(r, minCol, minCol + 1)).trim();
                    const eopStr = String(getSafeVal(eopRow, eopCol, eopCol + 1)).toUpperCase().trim();`;
content = content.replace(regex2, replace2);

const regex3 = /maxTm: parseInt\(String\(getVal\(r, maxCol\) \|\| "0"\)\.trim\(\)\) \|\| 0,/;
const replace3 = `maxTm: parseInt(String(getSafeVal(r, maxCol, maxCol + 1) || "0").trim()) || 0,`;
content = content.replace(regex3, replace3);

const regex4 = /const vVal = parseInt\(String\(getVal\(r, lsuCols\[l\]\.v\) \|\| "0"\)\.trim\(\)\) \|\| 0;\s*const pVal = parseInt\(String\(getVal\(r, lsuCols\[l\]\.p\) \|\| "0"\)\.trim\(\)\) \|\| 0;/g;
const replace4 = `const vVal = parseInt(String(getSafeVal(r, lsuCols[l].v, lsuCols[l].v + 1) || "0").trim()) || 0;
                        const pVal = parseInt(String(getSafeVal(r, lsuCols[l].p, lsuCols[l].p + 1) || "0").trim()) || 0;`;
content = content.replace(regex4, replace4);


fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Applied hardcoded positions with getSafeVal for merged/hidden columns');

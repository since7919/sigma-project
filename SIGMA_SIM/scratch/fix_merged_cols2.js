const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const regex1 = /\/\/ \[2\] 먼저 시그널맵의 기준점[\s\S]*?const rawSteps\s*=\s*\[\];/;

const replace1 = `// [2] 시그널맵 분석 엔진 (사용자 규칙 기반)
            // 사용자 확인: 엑셀에서 시그널맵의 행(Row) 위치와 열(Column) 위치는 항상 고정입니다.
            // 단, 병합된 셀(Merged Cells)이나 숨겨진 열로 인해 실제 값이 들어있는 컬럼 인덱스가 1~2칸 차이날 수 있으므로,
            // 주변 컬럼을 함께 검사하여 값을 추출합니다.
            const baseRowMapStart = 247;
            
            // 행(Row) 밀림 보정값 (기본 위치인 247행 기준이므로 0)
            const rMovA = 5;
            const rMovB = 12;

            // 병합/숨김 열 대비 안전한 값 추출 함수
            const getSafeVal = (r, cStart, cEnd) => {
                for (let c = cStart; c <= cEnd; c++) {
                    const v = getVal(r, c);
                    if (v !== null && String(v).trim() !== "") return v;
                }
                return "";
            };

            // [1] 이동류(Movement) ID 추출 (보정된 행 사용)
            const baseMovA = [], baseMovB = [];
            for (let c = 19; c <= 54; c += 5) {
                // 값이 병합되어 c+1 에 있을 수도 있으므로 확인
                let vA = getSafeVal(rMovA, c, c + 1);
                let vB = getSafeVal(rMovB, c, c + 1);
                baseMovA.push(parseInt(vA) || 0);
                baseMovB.push(parseInt(vB) || 0);
            }

            const minCol = 53, maxCol = 55, eopCol = 57; // 기본값 (기존 넓은 양식)
            const lsuCols = Array(8).fill(null).map((_, i) => ({ v: 5 + i * 6, p: 8 + i * 6 }));

            // [3] 시그널맵 분석 엔진
            const processRingData = (startRow, baseMovs, eopSourceRow = null) => {
                const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0 }));
                const rawSteps = [];`;

content = content.replace(regex1, replace1);

fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Applied regex1 successfully');

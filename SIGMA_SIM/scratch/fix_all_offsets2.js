const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const regex = /\/\/ \[1\] 이동류\(Movement\) ID 추출 \(Row 5 & 12\)[\s\S]*?const rawSteps\s*=\s*\[\];/;

const replace = `// [2] 먼저 시그널맵의 기준점(baseRowMapStart)을 정밀 탐색하여 행(Row) 밀림 오프셋을 계산합니다.
            let baseRowMapStart = 247;
            for (let r = 200; r < 350; r++) {
                const rowArr = sheetData[r] || [];
                const hasLSU1 = rowArr.some(c => String(c).toUpperCase().replace(/\\s/g, '') === 'LSU1');
                const hasMIN = rowArr.some(c => String(c).toUpperCase().replace(/\\s/g, '') === 'MIN');
                const hasEOP = rowArr.some(c => String(c).toUpperCase().replace(/\\s/g, '') === 'EOP');
                if (hasLSU1 && hasMIN && hasEOP) {
                    baseRowMapStart = r;
                    console.log(\`[Auto-Detect] 시그널맵 시작 헤더 행을 \${r} (0-indexed) 로 동적 감지했습니다.\`);
                    break;
                }
            }

            // 행(Row) 밀림 보정값 (기본 위치인 247행 기준)
            const shiftRows = baseRowMapStart - 247;
            const rMovA = 5 + shiftRows;
            const rMovB = 12 + shiftRows;

            // [1] 이동류(Movement) ID 추출 (보정된 행 사용)
            const baseMovA = [], baseMovB = [];
            for (let c = 19; c <= 54; c += 5) {
                baseMovA.push(parseInt(getVal(rMovA, c)) || 0);
                baseMovB.push(parseInt(getVal(rMovB, c)) || 0);
            }

            // [강력한 열(Column) 동적 탐색] 행 뿐만 아니라 열이 추가/삭제되어 밀린 경우까지 완벽 방어
            const headerRow1 = sheetData[baseRowMapStart] || [];
            const headerRow2 = sheetData[baseRowMapStart + 1] || [];
            
            let minCol = (headerRow1.findIndex(c => String(c).toUpperCase().replace(/\\s/g, '') === 'MIN') + 1) || 53;
            let maxCol = (headerRow1.findIndex(c => String(c).toUpperCase().replace(/\\s/g, '') === 'MAX') + 1) || 55;
            let eopCol = (headerRow1.findIndex(c => String(c).toUpperCase().replace(/\\s/g, '') === 'EOP') + 1) || 57;

            let lsuCols = Array(8).fill(null).map((_, i) => ({ v: 5 + i * 6, p: 8 + i * 6 }));
            for (let lsu = 1; lsu <= 8; lsu++) {
                const lsuStartIdx = headerRow1.findIndex(c => String(c).toUpperCase().replace(/\\s/g, '') === \`LSU\${lsu}\`);
                if (lsuStartIdx !== -1) {
                    let vFound = -1, pFound = -1;
                    for (let c = lsuStartIdx; c < lsuStartIdx + 5 && c < headerRow2.length; c++) {
                        const h2 = String(headerRow2[c] || "").toUpperCase().trim();
                        if (h2 === "V") vFound = c + 1;
                        if (h2 === "P") pFound = c + 1;
                    }
                    if (vFound !== -1) lsuCols[lsu - 1].v = vFound;
                    if (pFound !== -1) lsuCols[lsu - 1].p = pFound;
                }
            }

            // [3] 시그널맵 분석 엔진
            const processRingData = (startRow, baseMovs, eopSourceRow = null) => {
                const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0 }));
                const rawSteps = [];`;

content = content.replace(regex, replace);
fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Applied ALL fixes correctly');

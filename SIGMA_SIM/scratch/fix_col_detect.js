const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetStr = `            let baseRowMapStart = 247;
            
            // 엑셀 양식이 변경되어 시그널맵의 행(Row) 위치가 밀린 경우를 대비해 동적 탐색 (정확한 일치만 허용하여 False Positive 방지)
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
            
            const processRingData = (startRow, baseMovs, eopSourceRow = null) => {
                const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0 }));
                const rawSteps = [];
                
                // 동적 컬럼 탐지 (Auto-detection)
                // startRow-2 (행 인덱스 기준 startRow-3)는 "MIN", "EOP", "LSU 1" 등이 있는 헤더 줄
                // startRow-1 (행 인덱스 기준 startRow-2)는 "V", "P" 가 있는 서브헤더 줄
                let minCol = 53, maxCol = 55, eopCol = 57; // 기본값 (기존 넓은 양식)
                let lsuCols = Array(8).fill(null).map((_, i) => ({ v: 5 + i * 6, p: 8 + i * 6 }));

                // [수정] 엑셀에서 시그널맵의 위치와 열(Column) 구성은 항상 동일하므로, 
                // 동적 컬럼 탐색(findCol) 로직을 제거하고 기존의 안정적인 고정 좌표(Hard-coded index) 방식을 유지합니다.`;

const replaceStr = `            let baseRowMapStart = 247;
            
            // 엑셀 양식이 변경되어 시그널맵의 행(Row) 위치가 밀린 경우를 대비해 동적 탐색 (정확한 일치만 허용하여 False Positive 방지)
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
            
            // [강력한 열(Column) 동적 탐색] 행 뿐만 아니라 열이 추가/삭제되어 밀린 경우까지 대비
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
            
            const processRingData = (startRow, baseMovs, eopSourceRow = null) => {
                const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0 }));
                const rawSteps = [];`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Added strict column detection');

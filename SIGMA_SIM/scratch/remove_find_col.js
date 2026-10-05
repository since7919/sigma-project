const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetStr = `                let minCol = 53, maxCol = 55, eopCol = 57; // 기본값 (기존 넓은 양식)
                let lsuCols = Array(8).fill(null).map((_, i) => ({ v: 5 + i * 6, p: 8 + i * 6 }));

                // 엑셀 시트 데이터는 0-indexed 배열이며, getVal은 1-indexed 파라미터를 받음
                const headerRow1 = sheetData[startRow - 3] || [];
                const headerRow2 = sheetData[startRow - 2] || [];

                // 문자열을 찾아 1-indexed 컬럼 반환
                const findCol = (row, text) => {
                    for (let c = 0; c < row.length; c++) {
                        if (String(row[c]).toUpperCase().replace(/\\s/g, '').includes(text)) return c + 1;
                    }
                    return -1;
                };

                const detectedMin = findCol(headerRow1, "MIN");
                if (detectedMin !== -1) minCol = detectedMin;

                const detectedMax = findCol(headerRow1, "MAX");
                if (detectedMax !== -1) maxCol = detectedMax;

                const detectedEop = findCol(headerRow1, "EOP");
                if (detectedEop !== -1) eopCol = detectedEop;

                for (let lsu = 1; lsu <= 8; lsu++) {
                    const lsuStartCol = findCol(headerRow1, \`LSU\${lsu}\`) - 1; // 0-indexed로 변환
                    if (lsuStartCol !== -1) {
                        // LSU 주변 열(최대 5칸 이내)에서 V와 P 서브헤더 탐색
                        let vFound = -1, pFound = -1;
                        for (let c = lsuStartCol; c < lsuStartCol + 5 && c < headerRow2.length; c++) {
                            const h2 = String(headerRow2[c] || "").toUpperCase().trim();
                            if (h2 === "V") vFound = c + 1;
                            if (h2 === "P") pFound = c + 1;
                        }
                        if (vFound !== -1) lsuCols[lsu - 1].v = vFound;
                        if (pFound !== -1) lsuCols[lsu - 1].p = pFound;
                    }
                }`;

const replaceStr = `                let minCol = 53, maxCol = 55, eopCol = 57; // 기본값 (기존 넓은 양식)
                let lsuCols = Array(8).fill(null).map((_, i) => ({ v: 5 + i * 6, p: 8 + i * 6 }));

                // [수정] 엑셀에서 시그널맵의 위치와 열(Column) 구성은 항상 동일하므로, 
                // 동적 컬럼 탐색(findCol) 로직을 제거하고 기존의 안정적인 고정 좌표(Hard-coded index) 방식을 사용합니다.`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Removed dynamic findCol logic');

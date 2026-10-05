const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetStr = `            // [2] 시그널맵 분석 엔진 (사용자 규칙 기반)
            let baseRowMapStart = 247;
            // 엑셀 양식이 변경되거나 행이 밀린 경우를 대비하여 첫 번째 시그널맵의 헤더 줄 동적 탐색
            for (let r = 200; r < 350; r++) {
                const rowStr = (sheetData[r] || []).join('').replace(/\\s/g, '').toUpperCase();
                if (rowStr.includes('LSU1') && rowStr.includes('MIN') && rowStr.includes('EOP')) {
                    baseRowMapStart = r;
                    console.log(\`[Auto-Detect] 교차로 시그널맵 시작 행을 \${r}로 동적 감지했습니다.\`);
                    break;
                }
            }`;

const replaceStr = `            // [2] 시그널맵 분석 엔진 (사용자 규칙 기반)
            const baseRowMapStart = 247;`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Reverted baseRowMapStart');

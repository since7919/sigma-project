const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetStr = `            // [2] 시그널맵 분석 엔진 (사용자 규칙 기반)
            const baseRowMapStart = 247;
            const processRingData = (startRow, baseMovs, eopSourceRow = null) => {`;

const replaceStr = `            // [2] 시그널맵 분석 엔진 (사용자 규칙 기반)
            let baseRowMapStart = 247;
            
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
            
            const processRingData = (startRow, baseMovs, eopSourceRow = null) => {`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Added strict exact match for baseRowMapStart');

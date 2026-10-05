const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const regex = /\/\/\s*엑셀 시트 데이터는 0-indexed 배열이며, getVal은 1-indexed 파라미터를 받음[\s\S]*?if\s*\(pFound !== -1\)\s*lsuCols\[lsu\s*-\s*1\]\.p\s*=\s*pFound;\s*\}\s*\}/;

const replaceStr = `// [수정] 엑셀에서 시그널맵의 위치와 열(Column) 구성은 항상 동일하므로, 
                // 동적 컬럼 탐색(findCol) 로직을 제거하고 기존의 안정적인 고정 좌표(Hard-coded index) 방식을 유지합니다.`;

content = content.replace(regex, replaceStr);

fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Removed dynamic findCol logic with regex');

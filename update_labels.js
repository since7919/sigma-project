const fs = require('fs');

// Update index.html texts
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

// Replace texts
html = html.replace(/🏢 관리청\(구청\) 필터/g, '🏢 구청 필터');
html = html.replace(/>전체 관리청<\/option>/g, '>전체 구청</option>');
html = html.replace(/분석할 두 지역\(관리청\)을 선택하세요/g, '분석할 두 구청(또는 지역)을 선택하세요');

fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
console.log('UI labels updated to 구청');

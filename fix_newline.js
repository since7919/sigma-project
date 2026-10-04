const fs = require('fs');
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

html = html.replace('    \\n            <!-- 2', '    \\n            <!-- 2');
// Let's just fix it properly by searching for the literal characters '\n'
html = html.split('\\\\n').join('\\n');
html = html.replace(/\\n\s*<!-- 2\. \[교차로 데이터\]/g, '\\n            <!-- 2. [교차로 데이터]');

fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');

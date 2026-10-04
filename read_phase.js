const fs = require('fs');
const html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');
const start = html.indexOf('id="tab-phase"');
const end = html.indexOf('id="tab-group"');
console.log(html.substring(start, end).substring(0, 2500));

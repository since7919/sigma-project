const fs = require('fs');
const html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');
const start = html.indexOf('id="tab-info"');
const end = html.indexOf('id="tab-phase"');
console.log(html.substring(start, end));

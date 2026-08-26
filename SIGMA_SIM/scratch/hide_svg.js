const fs = require('fs');
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');
html = html.replace('id="overlay-svg-area" style="flex: 1;', 'id="overlay-svg-area" style="display: none; flex: 1;');
html = html.replace('id="overlay-summary-area" style="flex: 1;', 'id="overlay-summary-area" style="display: none; flex: 1;');
fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
console.log('HTML updated');

const fs = require('fs');
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

// Replace all multiple question marks and v=... with a clean ?v=...
html = html.replace(/\?+v=\d+/g, '?v=' + Date.now().toString());

fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
console.log('Fixed cache busting in index.html');

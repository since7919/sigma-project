const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/junction_optimizer.js', 'utf8');

code = code.replace(/document\.getElementById\(`row-preset-\$\{d.id\}`\);/g, 'document.getElementById(`td-preset-${d.id}`);');

fs.writeFileSync('SIGMA_SIM/js/junction_optimizer.js', code, 'utf8');

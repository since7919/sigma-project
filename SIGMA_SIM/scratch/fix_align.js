const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

code = code.replace('<div class="top-layout-opt flex-col gap-15 mb-8" style="align-items: flex-start;">', '<div class="top-layout-opt flex-col gap-15 mb-8" style="align-items: stretch; width: 100%;">');

fs.writeFileSync('SIGMA_SIM/index.html', code, 'utf8');

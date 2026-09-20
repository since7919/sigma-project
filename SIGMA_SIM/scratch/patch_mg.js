const fs = require('fs');
const path = 'SIGMA_SIM/index.html';
let content = fs.readFileSync(path, 'utf8');

// Hide tod-grid-main
content = content.replace('<div class="tod-grid-main">', '<div class="tod-grid-main" style="display:none;">');

// Remove border-top and margin-top from the div below it so it doesn't look weird
content = content.replace(
    'style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;"',
    'style="display:flex; justify-content:space-between; align-items:center;"'
);

fs.writeFileSync(path, content);
console.log('Done');

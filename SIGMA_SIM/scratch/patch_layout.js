const fs = require('fs');

const path = 'SIGMA_SIM/index.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Increase max-height of TOD Summary table container
content = content.replace('max-height:360px;', 'max-height:550px;');

// 2. Reduce margin-bottom of weekly-plan-container
content = content.replace('<div id="weekly-plan-container" style="margin-bottom: 12px;"></div>', '<div id="weekly-plan-container" style="margin-bottom: 6px;"></div>');

// 3. Reduce margin-bottom of tod-plan-info-container
content = content.replace('<div id="tod-plan-info-container" style="margin-bottom: 12px;"></div>', '<div id="tod-plan-info-container" style="margin-bottom: 6px;"></div>');

fs.writeFileSync(path, content);
console.log('Done patching layout');

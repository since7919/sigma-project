const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/index.css', 'utf8');

const oldCss = `.zoom-15-minus .safetyzone-tooltip {
  display: none !important;
}`;

if (content.includes(oldCss)) {
    content = content.replace(oldCss, '');
    fs.writeFileSync('../sigma-frontend/src/index.css', content, 'utf8');
    console.log('patched index.css');
} else {
    console.log('oldCss not found in index.css');
}

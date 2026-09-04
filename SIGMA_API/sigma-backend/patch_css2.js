const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/index.css', 'utf8');

const regex = /\.zoom-15-minus\s*\.safetyzone-tooltip\s*\{\s*display:\s*none\s*!important;\s*\}/g;

if (regex.test(content)) {
    content = content.replace(regex, '');
    fs.writeFileSync('../sigma-frontend/src/index.css', content, 'utf8');
    console.log('patched index.css with regex');
} else {
    console.log('regex not found');
}

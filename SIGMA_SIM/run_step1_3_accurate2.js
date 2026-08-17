const fs = require('fs');
let style = fs.readFileSync('css/style.css', 'utf8');

function extractBlock(startMarker, endMarker) {
    const start = style.indexOf(startMarker);
    if (start === -1) return null;
    let end;
    if (endMarker) {
        end = style.indexOf(endMarker, start);
        if (end === -1) return null;
    } else {
        end = style.length;
    }
    const block = style.substring(start, end);
    style = style.substring(0, start) + style.substring(end);
    return block;
}

let panelsCSS = fs.readFileSync('css/panels.css', 'utf8');

const blocks = [
    { s: '/* \uC0AC\uC774\uB4DC\uBC14 */', e: '/* Hide Number Input Spinners */' }
];

let resizerIdx = style.indexOf('.resizer {');
if (resizerIdx !== -1) {
    // go back to previous /*
    let start = style.lastIndexOf('/*', resizerIdx);
    let end = style.indexOf('/* Hide Number Input Spinners */', start);
    if (start !== -1 && end !== -1) {
        let block = style.substring(start, end);
        style = style.substring(0, start) + style.substring(end);
        panelsCSS += '\\n\\n' + block;
        console.log('Matched sidebar via .resizer index!');
    }
}

fs.writeFileSync('css/panels.css', panelsCSS, 'utf8');
fs.writeFileSync('css/style.css', style, 'utf8');

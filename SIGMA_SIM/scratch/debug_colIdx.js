const fs = require('fs');
let js = fs.readFileSync('../js/data_parser.js', 'utf8');

const target = `    const getCol = (cols, idx) => idx !== -1 ? cols[idx] : null;`;
const replace = `    console.log("[DEBUG CSV colIdx]", colIdx);
    const getCol = (cols, idx) => idx !== -1 ? cols[idx] : null;`;

if (js.includes(target)) {
    js = js.replace(target, replace);
    fs.writeFileSync('../js/data_parser.js', js);
    console.log("Added debug logs 2 to data_parser.js");
} else {
    console.log("Could not find target string.");
}

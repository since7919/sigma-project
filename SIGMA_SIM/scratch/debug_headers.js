const fs = require('fs');
let js = fs.readFileSync('../js/data_parser.js', 'utf8');

const target = `    const colIdx = {`;
const replace = `    console.log("[DEBUG CSV HEADERS]", headers);
    console.log("[DEBUG CSV NORMALIZED]", normalizedHeaders);
    const colIdx = {`;

if (js.includes(target)) {
    js = js.replace(target, replace);
    fs.writeFileSync('../js/data_parser.js', js);
    console.log("Added debug logs to data_parser.js");
} else {
    console.log("Could not find target string.");
}

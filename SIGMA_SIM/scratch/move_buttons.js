const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const toolbarRegex = /<!-- Floating Controls Container[\s\S]*?<\/div>\r?\n\s*<\/div>/;
const toolbarMatch = code.match(toolbarRegex);
if (!toolbarMatch) {
    console.error("Toolbar not found");
    process.exit(1);
}
code = code.replace(toolbarRegex, '');

const mapRegex = /<div id="overlay-leaflet-map" style="position: relative; flex: 1; height: 100%; z-index: 1;"><\/div>/;
const wrappedMap = `<div style="position: relative; flex: 1; height: 100%;">
    <div id="overlay-leaflet-map" style="position: absolute; top:0; left:0; width:100%; height:100%; z-index: 1;"></div>
    ${toolbarMatch[0]}
</div>`;

code = code.replace(mapRegex, wrappedMap);

fs.writeFileSync('SIGMA_SIM/index.html', code, 'utf8');
console.log("Success");

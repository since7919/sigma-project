const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

// 1. Modify modal-top-map to be a flex container
code = code.replace(
    '<div class="modal-top-map" id="overlay-map-area" style="position: relative;">',
    '<div class="modal-top-map" id="overlay-map-area" style="position: relative; display: flex;">'
);
code = code.replace(
    '<div id="overlay-leaflet-map" style="position: absolute; top:0; left:0; width:100%; height:100%; z-index: 1;"></div>',
    '<div id="overlay-leaflet-map" style="position: relative; flex: 1; height: 100%; z-index: 1;"></div>'
);

// 2. We need to extract the SVG banner and svg from viz-sidebar-opt and move it to overlay-svg-area
const svgSourceRegex = /<div id="junction-name-banner"[\s\S]*?<\/svg>\r?\n\s*<\/div>/;
const match = code.match(svgSourceRegex);
if (!match) {
    console.error("SVG source not found");
    process.exit(1);
}

const svgHtml = `<div id="overlay-svg-area" style="flex: 1; height: 100%; background: #0b0f19; border-left: 1px solid #1e293b; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
    ${match[0]}
</div>`;

// Delete it from the old location
code = code.replace(svgSourceRegex, '');

// Insert it into modal-top-map
code = code.replace(
    '<div id="overlay-leaflet-map" style="position: relative; flex: 1; height: 100%; z-index: 1;"></div>',
    '<div id="overlay-leaflet-map" style="position: relative; flex: 1; height: 100%; z-index: 1;"></div>\n                  ' + svgHtml
);

fs.writeFileSync('SIGMA_SIM/index.html', code, 'utf8');
console.log("Success");

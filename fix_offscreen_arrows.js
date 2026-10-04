const fs = require('fs');

// 1. Revert Zoom back to 18 in overlay_ui.js
let c1 = fs.readFileSync('SIGMA_SIM/js/overlay_ui.js', 'utf8');
c1 = c1.replace(
    /overlayMap\.setView\(\[STATE\.junctions\[jid\]\.lat, STATE\.junctions\[jid\]\.lng\], STATE\.overlayDisplayMode === 'arrow' \? 19\.5 : 18\);/,
    `overlayMap.setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 18);`
);
c1 = c1.replace(
    /overlayMap\.setZoom\(STATE\.overlayDisplayMode === 'arrow' \? 19\.5 : 18\);/,
    `overlayMap.setZoom(18);`
);
fs.writeFileSync('SIGMA_SIM/js/overlay_ui.js', c1, 'utf8');
console.log("overlay_ui.js reverted to zoom 18.");

// 2. Adjust multi to 4.0 in junction_map.js
let c2 = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');
c2 = c2.replace(
    /const multi = 7\.0;/,
    `const multi = 4.0;`
);
fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c2, 'utf8');
console.log("junction_map.js multi adjusted to 4.0.");

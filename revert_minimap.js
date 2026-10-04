const fs = require('fs');

// 1. overlay_ui.js: zoom stays at 18
let c1 = fs.readFileSync('SIGMA_SIM/js/overlay_ui.js', 'utf8');
c1 = c1.replace(
    /overlayMap\.setView\(\[STATE\.junctions\[jid\]\.lat, STATE\.junctions\[jid\]\.lng\], 18\);/g,
    `overlayMap.setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 18);`
);
c1 = c1.replace(
    /overlayMap\.setView\(\[STATE\.junctions\[jid\]\.lat, STATE\.junctions\[jid\]\.lng\], STATE\.overlayDisplayMode === 'arrow' \? 20 : 18\);/g,
    `overlayMap.setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 18);`
);
c1 = c1.replace(
    /overlayMap\.setZoom\(STATE\.overlayDisplayMode === 'arrow' \? 20 : 18\);/g,
    `// zoom is fixed at 18`
);
fs.writeFileSync('SIGMA_SIM/js/overlay_ui.js', c1, 'utf8');

// 2. junction_map.js: remove multi in createOverlayArrows
let c2 = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');
c2 = c2.replace(
    /const multi = 4\.0;\s*const pos = \[j\.lat \+ config\.dLat \* multi, j\.lng \+ config\.dLng \* multi\];/g,
    `const pos = [j.lat + config.dLat, j.lng + config.dLng];`
);
fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c2, 'utf8');
console.log("Reverted to 1:1 mapping with zoom 18.");

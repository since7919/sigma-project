const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/overlay_ui.js', 'utf8');

c = c.replace(
    /if \(window\._currentOverlayJid\) \{\s*if \(typeof createOverlayArrows === 'function'\) \{\s*createOverlayArrows\(window\._currentOverlayJid, overlayMap\);\s*\}\s*\}/,
    `if (window._currentOverlayJid) {
        if (typeof createOverlayArrows === 'function') {
            createOverlayArrows(window._currentOverlayJid, overlayMap);
        }
        if (overlayMap) {
            overlayMap.setZoom(STATE.overlayDisplayMode === 'arrow' ? 19.5 : 18);
        }
    }`
);

c = c.replace(
    /overlayMap\.setView\(\[STATE\.junctions\[jid\]\.lat, STATE\.junctions\[jid\]\.lng\], 18\);/,
    `overlayMap.setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], STATE.overlayDisplayMode === 'arrow' ? 19.5 : 18);`
);

fs.writeFileSync('SIGMA_SIM/js/overlay_ui.js', c, 'utf8');
console.log("overlay_ui.js zoom updated.");

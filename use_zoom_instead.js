const fs = require('fs');

// 1. Revert Zoom back to 20 in overlay_ui.js
let c1 = fs.readFileSync('SIGMA_SIM/js/overlay_ui.js', 'utf8');
c1 = c1.replace(
    /overlayMap\.setView\(\[STATE\.junctions\[jid\]\.lat, STATE\.junctions\[jid\]\.lng\], 18\);/,
    `overlayMap.setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], STATE.overlayDisplayMode === 'arrow' ? 20 : 18);`
);
c1 = c1.replace(
    /overlayMap\.setZoom\(18\);/,
    `overlayMap.setZoom(STATE.overlayDisplayMode === 'arrow' ? 20 : 18);`
);
fs.writeFileSync('SIGMA_SIM/js/overlay_ui.js', c1, 'utf8');
console.log("overlay_ui.js updated to zoom 20.");

// 2. Remove multi entirely in junction_map.js
let c2 = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');
c2 = c2.replace(
    /\/\/ \[개선\] 상세보기 미니맵에서는 지도 배율이 고정되어 있어 화살표가 겹치므로,\s*\/\/ 시각적 가독성을 위해 중심점으로부터의 거리를 2\.5배 띄워서 렌더링합니다\.\s*const multi = 4\.0;\s*const pos = \[j\.lat \+ config\.dLat \* multi, j\.lng \+ config\.dLng \* multi\];/,
    `const pos = [j.lat + config.dLat, j.lng + config.dLng];`
);
fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c2, 'utf8');
console.log("junction_map.js multi removed.");

const fs = require('fs');

const path = '../js/overlay_ui.js';
let js = fs.readFileSync(path, 'utf8');

const regex = /\/\/ Google Satellite Map 초기화 및 이동[\s\S]*?}, 100\);/g;

const newCode = `// Google Satellite Map 초기화 및 이동
    if (!overlayMap) {
        overlayMap = L.map('overlay-leaflet-map', {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            touchZoom: false,
            doubleClickZoom: false,
            scrollWheelZoom: false,
            boxZoom: false,
            keyboard: false
        });
        L.tileLayer('https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 22
        }).addTo(overlayMap);
    }

    setTimeout(() => {
        if (overlayMap) {
            overlayMap.invalidateSize();
            overlayMap.setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 18);
            
            // 중앙 원형 마커 그리기
            if (window._overlayCenterMarker) {
                overlayMap.removeLayer(window._overlayCenterMarker);
            }
            // 가시성을 높이기 위해 형광 노란색으로 변경 및 invalidateSize 이후 렌더링
            window._overlayCenterMarker = L.circleMarker([STATE.junctions[jid].lat, STATE.junctions[jid].lng], {
                radius: 9,
                fillColor: '#ffea00',
                color: '#000',
                weight: 2,
                fillOpacity: 0.9
            }).addTo(overlayMap);

            if (typeof createOverlayArrows === 'function') {
                createOverlayArrows(jid, overlayMap);
                if (typeof updateSim === 'function') updateSim();
            }
        }
    }, 150);`;

if (js.match(regex)) {
    js = js.replace(regex, newCode);
    fs.writeFileSync(path, js);
    console.log("Successfully patched overlay_ui.js");
} else {
    console.log("Regex not matched");
}

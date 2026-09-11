const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

const oldStyle = `        const geoLayer = L.geoJSON(featureCollection, {
            style: { color: '#e74c3c', weight: 2, fillColor: '#f39c12', fillOpacity: 0.2 },
            pointToLayer: function (feature, latlng) {
              return L.circleMarker(latlng, {
                  radius: 8,
                  color: '#e74c3c',
                  weight: 2,
                  fillColor: '#f39c12',
                  fillOpacity: 0.8
              });
            },`;

const newStyle = `        const geoLayer = L.geoJSON(featureCollection, {
            style: { color: '#f1c40f', weight: 2, fillColor: '#f4d03f', fillOpacity: 0.3, interactive: true },
            pointToLayer: function (feature, latlng) {
              return L.circleMarker(latlng, {
                  radius: 8,
                  color: '#fff',
                  weight: 2,
                  fillColor: '#f1c40f',
                  fillOpacity: 0.8
              });
            },`;

content = content.replace(oldStyle, newStyle);
fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', content, 'utf8');
console.log('patched SafetyZoneOverlay.jsx style');

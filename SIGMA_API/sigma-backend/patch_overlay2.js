const fs = require('fs');
let overlay = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

overlay = overlay.replace(
    'geometry.properties = { ...geometry.properties, name: item.trgtFcltNm',
    'geometry.properties = { ...geometry.properties, type: item.fcltTypeCd || "1", name: item.trgtFcltNm'
);

overlay = overlay.replace(
    'properties: { name: item.trgtFcltNm',
    'properties: { type: item.fcltTypeCd || "1", name: item.trgtFcltNm'
);

overlay = overlay.replace(
    `style: { color: '#f1c40f', weight: 2, fillColor: '#f4d03f', fillOpacity: 0.3, interactive: true },`,
    `style: function(feature) {
                const type = feature.properties ? feature.properties.type : '1';
                let color = '#f1c40f';
                let fillColor = '#f4d03f';
                if (type === '2') { color = '#d4ac0d'; fillColor = '#f1c40f'; }
                else if (type === '3') { color = '#f7dc6f'; fillColor = '#fcf3cf'; }
                return { color: color, weight: 2, fillColor: fillColor, fillOpacity: 0.3, interactive: true };
            },`
);

overlay = overlay.replace(
    `pointToLayer: function (feature, latlng) {
              return L.circleMarker(latlng, {
                  radius: 8,
                  color: '#fff',
                  weight: 2,
                  fillColor: '#f1c40f',
                  fillOpacity: 0.8
              });
            },`,
    `pointToLayer: function (feature, latlng) {
              const type = feature.properties ? feature.properties.type : '1';
              let fillColor = '#f1c40f';
              if (type === '2') fillColor = '#d4ac0d';
              else if (type === '3') fillColor = '#f7dc6f';
              return L.circleMarker(latlng, {
                  radius: 8,
                  color: '#fff',
                  weight: 2,
                  fillColor: fillColor,
                  fillOpacity: 0.8
              });
            },`
);

fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', overlay, 'utf8');
console.log('patched successfully');

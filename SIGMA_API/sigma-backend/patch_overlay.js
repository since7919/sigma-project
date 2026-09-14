const fs = require('fs');
let overlay = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

const oldProps = `               features.push({
                   type: 'Feature',
                   geometry: geometry,
                   properties: { name: item.trgtFcltNm || "알 수 없음" }
               });`;

const newProps = `               features.push({
                   type: 'Feature',
                   geometry: geometry,
                   properties: { name: item.trgtFcltNm || "알 수 없음", type: item.fcltTypeCd || '1' }
               });`;

overlay = overlay.replace(oldProps, newProps);

const oldStyle = `          const geoLayer = L.geoJSON(featureCollection, {
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

const newStyle = `          const geoLayer = L.geoJSON(featureCollection, {
            style: function(feature) {
                const type = feature.properties?.type;
                let color = '#f1c40f'; // 1 (어린이)
                let fillColor = '#f4d03f';
                if (type === '2') { color = '#d4ac0d'; fillColor = '#f1c40f'; } // 2 (노인)
                else if (type === '3') { color = '#f7dc6f'; fillColor = '#fcf3cf'; } // 3 (장애인)
                return { color: color, weight: 2, fillColor: fillColor, fillOpacity: 0.3, interactive: true };
            },
            pointToLayer: function (feature, latlng) {
              const type = feature.properties?.type;
              let fillColor = '#f1c40f'; // 1 (어린이)
              if (type === '2') fillColor = '#d4ac0d'; // 2 (노인)
              else if (type === '3') fillColor = '#f7dc6f'; // 3 (장애인)
              return L.circleMarker(latlng, {
                  radius: 8,
                  color: '#fff',
                  weight: 2,
                  fillColor: fillColor,
                  fillOpacity: 0.8
              });
            },`;

overlay = overlay.replace(oldStyle, newStyle);

fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', overlay, 'utf8');
console.log('patched SafetyZoneOverlay.jsx');

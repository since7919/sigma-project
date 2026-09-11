const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

const oldEffect = `        if (!currentRegion) {
          setSafetyZoneLayer(null);
          return;
        }`;

const newEffect = `        if (!currentRegion) {
          if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
          }
          setSafetyZoneLayer(null);
          return;
        }`;

content = content.replace(oldEffect, newEffect);
fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', content, 'utf8');
console.log('patched SafetyZoneOverlay.jsx clear layer logic');

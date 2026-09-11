const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

// Replace style using regex to ensure it matches
content = content.replace(/style:\s*\{\s*color:\s*'#[a-zA-Z0-9]+',\s*weight:\s*2,\s*fillColor:\s*'#[a-zA-Z0-9]+',\s*fillOpacity:\s*0\.2\s*\}/g, "style: { color: '#f1c40f', weight: 2, fillColor: '#f4d03f', fillOpacity: 0.3, interactive: true }");

content = content.replace(/return L\.circleMarker\(latlng,\s*\{[\s\S]*?\}\);/g, `return L.circleMarker(latlng, {
                  radius: 8,
                  color: '#fff',
                  weight: 2,
                  fillColor: '#f1c40f',
                  fillOpacity: 0.8
              });`);

// Fix the region update logic
content = content.replace(
`  const updateRegion = () => {
    if (!intersections || intersections.length === 0) return;
    const bounds = map.getBounds();`,
`  const updateRegion = () => {
    const bounds = map.getBounds();
    if (!intersections || intersections.length === 0) {
      if (currentRegion !== null) setCurrentRegion(null);
      return;
    }`
);

fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', content, 'utf8');
console.log('patched style and logic');

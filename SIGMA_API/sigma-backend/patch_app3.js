const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/App.jsx', 'utf8');

const oldCode = '<SafetyZoneOverlay isVisible={isSafetyZoneOn} />';
const newCode = '<SafetyZoneOverlay isVisible={isSafetyZoneOn} regionCode={filteredIntersections.length > 0 ? filteredIntersections[0].region_cd : "L01"} />';

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync('../sigma-frontend/src/App.jsx', content, 'utf8');
    console.log('patched App.jsx');
} else {
    console.log('oldCode not found in App.jsx');
}

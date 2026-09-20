const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

const oldCode = `    // 2. Sidebar UTIC accordion priority
    if (uticOpenRegions && uticOpenRegions.length > 0) {
      const preferred = uticOpenRegions[0];
      if (currentRegion !== preferred) setCurrentRegion(preferred);
      return;
    }`;

const newCode = `    // 2. Sidebar UTIC accordion priority
    if (uticOpenRegions) {
      const openKeys = Object.keys(uticOpenRegions).filter(k => uticOpenRegions[k]);
      if (openKeys.length > 0) {
        // e.g. 'L01 서울시' -> 'L01'
        const preferred = openKeys[0].substring(0, 3);
        if (currentRegion !== preferred) setCurrentRegion(preferred);
        return;
      }
    }`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', content, 'utf8');
console.log('patched object iteration');

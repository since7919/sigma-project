const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

content = content.replace(
  '  }, [intersections]);',
  '  }, [intersections, uticOpenRegions, activeTab]);'
);

fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', content, 'utf8');
console.log('patched deps');

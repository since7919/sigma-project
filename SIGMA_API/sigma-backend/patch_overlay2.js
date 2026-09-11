const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

const oldEffect = /  useEffect\(\(\) => \{\n    let isMounted = true;\n    const fetchAndDraw = async \(\) => \{\n      try \{\n        const res = await axios\.get\(`\$\{API_BASE\}\/api\/safetyzone\?regionCode=\$\{currentRegion\}`\);/m;

const newEffect = `  useEffect(() => {
    let isMounted = true;
    const fetchAndDraw = async () => {
      try {
        if (!currentRegion) {
          setSafetyZoneLayer(null);
          return;
        }
        const res = await axios.get(\`\${API_BASE}/api/safetyzone?regionCode=\${currentRegion}\`);`;

content = content.replace(oldEffect, newEffect);
fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', content, 'utf8');
console.log('patched SafetyZoneOverlay.jsx logic');

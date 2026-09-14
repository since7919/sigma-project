const fs = require('fs');
let overlay = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

const updateRegionRegex = /const updateRegion = \(\) => \{[\s\S]*?if \(currentRegion !== maxRegion\) \{\s*setCurrentRegion\(maxRegion\);\s*\}\s*\};/m;

const newUpdateRegion = `const updateRegion = () => {
    if (activeTab === 'tdata') {
      if (currentRegion !== 'L01') setCurrentRegion('L01');
      return;
    }
    
    if (uticOpenRegions) {
      const openKeys = Object.keys(uticOpenRegions).filter(k => uticOpenRegions[k]);
      if (openKeys.length > 0) {
        const preferred = openKeys[0].substring(0, 3);
        if (currentRegion !== preferred) setCurrentRegion(preferred);
        return;
      }
    }
    
    // If no regions are explicitly open in UTIC tab, clear the safety zones.
    // (We remove the map-bounds fallback because it falsely defaults to Incheon when zoomed out)
    if (currentRegion !== null) {
      setCurrentRegion(null);
    }
  };`;

if (updateRegionRegex.test(overlay)) {
    overlay = overlay.replace(updateRegionRegex, newUpdateRegion);
    fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', overlay, 'utf8');
    console.log('patched updateRegion successfully');
} else {
    console.log('regex failed');
}

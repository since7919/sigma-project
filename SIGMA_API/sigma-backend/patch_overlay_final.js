const fs = require('fs');

// 1. Patch App.jsx
let appJsx = fs.readFileSync('../sigma-frontend/src/App.jsx', 'utf8');
appJsx = appJsx.replace(
    '<SafetyZoneOverlay isVisible={isSafetyZoneOn} intersections={filteredIntersections} />',
    '<SafetyZoneOverlay isVisible={isSafetyZoneOn} intersections={filteredIntersections} uticOpenRegions={uticOpenRegions} activeTab={activeTab} />'
);
fs.writeFileSync('../sigma-frontend/src/App.jsx', appJsx, 'utf8');

// 2. Patch SafetyZoneOverlay.jsx
let overlayJsx = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');
overlayJsx = overlayJsx.replace(
    'export default function SafetyZoneOverlay({ isVisible, intersections }) {',
    'export default function SafetyZoneOverlay({ isVisible, intersections, uticOpenRegions, activeTab }) {'
);

const oldUpdateRegion = /  const updateRegion = \(\) => \{[\s\S]*?    if \(maxRegion !== currentRegion\) \{\n      setCurrentRegion\(maxRegion\);\n    \}\n  \};/m;

const newUpdateRegion = `  const updateRegion = () => {
    // 1. Sidebar tab priority
    if (activeTab === 'tdata') {
      if (currentRegion !== 'L01') setCurrentRegion('L01');
      return;
    }
    
    // 2. Sidebar UTIC accordion priority
    if (uticOpenRegions && uticOpenRegions.length > 0) {
      const preferred = uticOpenRegions[0];
      if (currentRegion !== preferred) setCurrentRegion(preferred);
      return;
    }

    // 3. Fallback to Map Bounds logic
    const bounds = map.getBounds();
    if (!intersections || intersections.length === 0) {
      if (currentRegion !== null) setCurrentRegion(null);
      return;
    }
    
    let regionCount = {};
    let maxRegion = currentRegion;
    let maxCount = 0;
    
    for (const item of intersections) {
      if (!item.y_coord || !item.x_coord) continue;
      if (bounds.contains([item.y_coord, item.x_coord])) {
        const r = item.region_cd || 'L01';
        regionCount[r] = (regionCount[r] || 0) + 1;
        if (regionCount[r] > maxCount) {
          maxCount = regionCount[r];
          maxRegion = r;
        }
      }
    }
    
    if (maxCount === 0) {
      let globalCount = {};
      let globalMaxCount = 0;
      let globalMaxRegion = null;
      for (const item of intersections) {
        const r = item.region_cd || 'L01';
        globalCount[r] = (globalCount[r] || 0) + 1;
        if (globalCount[r] > globalMaxCount) {
          globalMaxCount = globalCount[r];
          globalMaxRegion = r;
        }
      }
      if (globalMaxRegion) {
        maxRegion = globalMaxRegion;
      }
    }
    
    if (maxRegion !== currentRegion) {
      setCurrentRegion(maxRegion);
    }
  };`;

overlayJsx = overlayJsx.replace(oldUpdateRegion, newUpdateRegion);
fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', overlayJsx, 'utf8');

console.log('patched App.jsx and SafetyZoneOverlay.jsx');

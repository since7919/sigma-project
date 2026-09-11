const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', 'utf8');

const oldUpdateRegion = `  const updateRegion = () => {
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
    
    if (maxRegion !== currentRegion) {
      setCurrentRegion(maxRegion);
    }
  };`;

const newUpdateRegion = `  const updateRegion = () => {
    const bounds = map.getBounds();
    if (!intersections || intersections.length === 0) {
      if (currentRegion !== null) setCurrentRegion(null);
      return;
    }
    
    let regionCount = {};
    let maxRegion = currentRegion;
    let maxCount = 0;
    
    // 1. 현재 화면(Bounds) 내의 교차로들을 먼저 검사
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
    
    // 2. 화면 내에 교차로가 한 개도 없다면, 전체 intersections 배열에서 가장 많은 지역을 선택
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

content = content.replace(oldUpdateRegion, newUpdateRegion);
fs.writeFileSync('../sigma-frontend/src/components/SafetyZoneOverlay.jsx', content, 'utf8');
console.log('patched updateRegion');

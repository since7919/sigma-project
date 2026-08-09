const fs = require('fs');

// 1. Update useSignalPhases.js
const hookFile = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/hooks/useSignalPhases.js';
let hookCode = fs.readFileSync(hookFile, 'utf8');

// Add sigMapDataList to destructured props
hookCode = hookCode.replace(
  'export function useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData }) {',
  'export function useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData, sigMapDataList }) {'
);

// Inject sigMapDataListLocal after useMemo start
const memoStart = hookCode.indexOf('return useMemo(() => {');
const insertIndex = hookCode.indexOf('\n', memoStart) + 1;
const localDecl = `    const sigMapDataListLocal = sigMapDataList && sigMapDataList.length > 0 ? sigMapDataList : (sigMapData ? [sigMapData] : []);\n`;
hookCode = hookCode.slice(0, insertIndex) + localDecl + hookCode.slice(insertIndex);

// Replace sigMapDataList with sigMapDataListLocal
hookCode = hookCode.replace(/sigMapDataList/g, 'sigMapDataListLocal');
// Fix double Local if any
hookCode = hookCode.replace(/sigMapDataListLocalLocal/g, 'sigMapDataListLocal');

fs.writeFileSync(hookFile, hookCode, 'utf8');
console.log('useSignalPhases.js updated');

// 2. Update SingleDetailOverlay.jsx to pass sigMapDataList
const detailFile = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/components/SingleDetailOverlay.jsx';
let detailCode = fs.readFileSync(detailFile, 'utf8');

detailCode = detailCode.replace(
  'useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData })',
  'useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData, sigMapDataList })'
);

fs.writeFileSync(detailFile, detailCode, 'utf8');
console.log('SingleDetailOverlay.jsx updated');

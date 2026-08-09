const fs = require('fs');

const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/hooks/useSignalPhases.js';
let code = fs.readFileSync(file, 'utf8');

// Replace top of useSignalPhases with clean non-colliding variable names
code = code.replace(
  'export function useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData, sigMapDataListLocal }) {',
  'export function useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData, sigMapDataList }) {'
);

code = code.replace(
  'const sigMapDataListLocal = sigMapDataListLocal && sigMapDataListLocal.length > 0 ? sigMapDataListLocal : (sigMapData ? [sigMapData] : []);',
  'const activeSigMapList = sigMapDataList && sigMapDataList.length > 0 ? sigMapDataList : (sigMapData ? [sigMapData] : []);'
);

// Replace all usages of sigMapDataListLocal with activeSigMapList
code = code.replace(/sigMapDataListLocal/g, 'activeSigMapList');

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed self-referential TDZ parameter bug in useSignalPhases.js!');

const fs = require('fs');

const code = fs.readFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/components/SingleDetailOverlay.jsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('const updatedPhases = useMemo(() => {'));
let braceCount = 0;
let end = -1;
if (start !== -1) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('{')) braceCount += (lines[i].match(/\{/g) || []).length;
    if (lines[i].includes('}')) braceCount -= (lines[i].match(/\}/g) || []).length;
    if (braceCount === 0 && i > start) {
      end = i;
      break;
    }
  }
  const extracted = lines.slice(start, end + 1).join('\n');
  const hookContent = `import { useMemo } from 'react';
import { parsePhaseCode, isCarActive, isPedActive } from '../utils/signalUtils';

export function useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData }) {
  ${extracted.replace('const updatedPhases = useMemo', 'return useMemo')}
}
`;
  fs.writeFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/hooks/useSignalPhases.js', hookContent, 'utf8');
  console.log('Hook created!');
}

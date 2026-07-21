const fs = require('fs');
const path = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js';
let code = fs.readFileSync(path, 'utf8');

const startStr = 'export function calculateCompassSignals({';
const endIdxRaw = code.lastIndexOf('}');
const startIdx = code.indexOf(startStr);
const endIdx = endIdxRaw + 1;

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `export function calculateCompassSignals({ updatedPhases }) {
  const directions = [
    { key: 'N', deg: 0 },
    { key: 'NE', deg: 45 },
    { key: 'E', deg: 90 },
    { key: 'SE', deg: 135 },
    { key: 'S', deg: 180 },
    { key: 'SW', deg: 225 },
    { key: 'W', deg: 270 },
    { key: 'NW', deg: 315 }
  ];

  const directionLabels = {
    'N': '북', 'E': '동', 'S': '남', 'W': '서',
    'NE': '북동', 'SE': '남동', 'SW': '남서', 'NW': '북서'
  };

  return directions.map(({ key, deg }) => {
    let s = 'off', l = 'off', p = 'off';
    let carCountdown = 0;
    let pedCountdown = 0;
    let vehHasData = false;
    let pedHasData = false;

    if (updatedPhases && updatedPhases.length > 0) {
      const sMatches = updatedPhases.filter(ph => ph.angle === deg && ph.type === 'S');
      const lMatches = updatedPhases.filter(ph => ph.angle === deg && ph.type === 'L');
      const pMatches = updatedPhases.filter(ph => ph.angle === deg && ph.type === 'P');

      if (sMatches.length > 0 || lMatches.length > 0) vehHasData = true;
      if (pMatches.length > 0) pedHasData = true;

      const getStatusAndCountdown = (matches) => {
        if (matches.length === 0) return { state: 'off', countdown: 0 };
        // 우선순위: green -> flash -> yellow -> red -> off
        const activeMatch = matches.find(m => m.statusClass === 'sig-status-green' || m.statusClass === 'sig-status-flash' || m.statusClass === 'sig-status-yellow');
        const matchToUse = activeMatch || matches[0];
        
        let state = 'off';
        if (matchToUse.statusClass === 'sig-status-green') state = 'green';
        else if (matchToUse.statusClass === 'sig-status-yellow') state = 'yellow';
        else if (matchToUse.statusClass === 'sig-status-flash') state = 'flash';
        else if (matchToUse.statusClass === 'sig-status-red') state = 'red';
        
        const cdown = parseInt(matchToUse.remaining) || 0;
        return { state, countdown: cdown };
      };

      const sResult = getStatusAndCountdown(sMatches);
      s = sResult.state;
      carCountdown = Math.max(carCountdown, sResult.countdown);

      const lResult = getStatusAndCountdown(lMatches);
      l = lResult.state;
      carCountdown = Math.max(carCountdown, lResult.countdown);

      const pResult = getStatusAndCountdown(pMatches);
      p = pResult.state;
      pedCountdown = Math.max(pedCountdown, pResult.countdown);
    } else {
      if (['N', 'E', 'S', 'W'].includes(key)) {
        vehHasData = true;
        pedHasData = true;
        s = 'red';
        l = 'red';
        p = 'red';
      }
    }

    let crOn = s === 'red' || l === 'red';
    let cyOn = s === 'yellow' || l === 'yellow';
    let caOn = l === 'green';
    let cgOn = s === 'green';

    let prOn = p === 'red' || p === 'off';
    let pgOn = p === 'green' || p === 'flash';

    let carColor = '#fff';
    if (cgOn || caOn) carColor = '#10b981';
    else if (cyOn) carColor = '#f59e0b';
    else if (crOn) carColor = '#ef4444';

    let pedColor = '#fff';
    if (pgOn) pedColor = '#10b981';
    else if (prOn) pedColor = '#ef4444';

    const dirLabel = directionLabels[key] || '';

    return {
      key,
      deg,
      vehHasData,
      pedHasData,
      carCountdown,
      pedCountdown,
      crOn,
      cyOn,
      caOn,
      cgOn,
      prOn,
      pgOn,
      carColor,
      pedColor,
      dirLabel
    };
  });
}
`;
  
  code = code.substring(0, startIdx) + replacement;
  fs.writeFileSync(path, code, 'utf8');
  console.log('Replaced calculateCompassSignals successfully.');
} else {
  console.log('Could not find start or end index.');
}

const fs = require('fs');
const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js';
let code = fs.readFileSync(file, 'utf8');

// The goal is to remove the massive fallback logic.
// We can use regex or string replace to clean it up.
// Actually, it's easier to just overwrite signalUtils.js with a clean version of the two functions.

const newFunctions = `
export function calculateArrowSignals({ updatedPhases }) {
  if (!updatedPhases) return [];
  const vehicles = Array.from({ length: 16 }, (_, i) => i + 1);
  const peds = Array.from({ length: 16 }, (_, i) => i + 101);
  const allMovs = [...vehicles, ...peds];

  return allMovs.map(m => {
    const isPed = m >= 100;
    const arrowData = isPed ? { type: 'WALK', ang: 0 } : getVisualArrowLocal(m);
    
    let topPx = 90;
    let leftPx = 90;
    
    if (isPed) {
      const pedAngles = [0, 90, 180, 270, 0, 90, 180, 270];
      const a = pedAngles[(m - 101) % 8];
      const r = 55;
      const rad = (a - 90) * Math.PI / 180;
      leftPx = 90 + r * Math.cos(rad);
      topPx = 90 + r * Math.sin(rad);
    } else {
      const r = 38;
      const a = defPosAngles[(m - 1) % 16] || 0;
      const rad = (a - 90) * Math.PI / 180;
      leftPx = 90 + r * Math.cos(rad);
      topPx = 90 + r * Math.sin(rad);
    }
    
    let textRot = 0;
    if (!isPed) {
      textRot = arrowData.ang;
    }
    
    let signalState = 'off';
    let countdown = 0;
    
    const degVal = defPosAngles[(isPed ? (m - 101) : (m - 1)) % 16] || 0;
    const mType = isPed ? 'P' : (m % 2 !== 0 ? 'L' : 'S');
    const match = updatedPhases.find(p => p.angle === degVal && p.type === mType);
    
    if (match) {
      if (match.statusClass === 'sig-status-green') signalState = 'G';
      else if (match.statusClass === 'sig-status-yellow') signalState = 'Y';
      else if (match.statusClass === 'sig-status-flash') signalState = 'F';
      else if (match.statusClass === 'sig-status-red' || match.statusClass === 'sig-status-gray') signalState = 'off';
      
      countdown = parseInt(match.remaining) || 0;
    }
    
    const colorClass = (isPed && signalState === 'F') ? 'green' : (signalState === 'Y' || signalState === 'F') ? 'yellow' : 'green';
    
    return {
      m,
      isPed,
      arrowData,
      topPx,
      leftPx,
      textRot,
      signalState,
      countdown,
      colorClass
    };
  });
}

export function calculateCompassSignals({ updatedPhases }) {
  if (!updatedPhases) return [];
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
    let sigS = 'off', sigL = 'off', sigP = 'off';
    let carCountdown = 0;
    let pedCountdown = 0;
    let vehHasData = false;
    let pedHasData = false;

    const sMatches = updatedPhases.filter(ph => ph.angle === deg && ph.type === 'S');
    const lMatches = updatedPhases.filter(ph => ph.angle === deg && ph.type === 'L');
    const pMatches = updatedPhases.filter(ph => ph.angle === deg && ph.type === 'P');

    if (sMatches.length > 0 || lMatches.length > 0) vehHasData = true;
    if (pMatches.length > 0) pedHasData = true;

    const getStatusAndCountdown = (matches) => {
      if (matches.length === 0) return { state: 'off', countdown: 0 };
      const activeMatch = matches.find(m => m.statusClass === 'sig-status-green' || m.statusClass === 'sig-status-flash' || m.statusClass === 'sig-status-yellow');
      const matchToUse = activeMatch || matches[0];
      
      let state = 'red';
      if (matchToUse.statusClass === 'sig-status-green') state = 'green';
      else if (matchToUse.statusClass === 'sig-status-yellow') state = 'yellow';
      else if (matchToUse.statusClass === 'sig-status-flash') state = 'flash';
      
      const cdown = parseInt(matchToUse.remaining) || 0;
      return { state, countdown: cdown };
    };

    const sResult = getStatusAndCountdown(sMatches);
    sigS = sResult.state;
    carCountdown = Math.max(carCountdown, sResult.countdown);

    const lResult = getStatusAndCountdown(lMatches);
    sigL = lResult.state;
    carCountdown = Math.max(carCountdown, lResult.countdown);

    const pResult = getStatusAndCountdown(pMatches);
    sigP = pResult.state;
    pedCountdown = Math.max(pedCountdown, pResult.countdown);

    let crOn = sigS === 'red' || sigL === 'red';
    let cyOn = sigS === 'yellow' || sigL === 'yellow';
    let caOn = sigL === 'green';
    let cgOn = sigS === 'green';

    let prOn = sigP === 'red';
    let pgOn = sigP === 'green' || sigP === 'flash';

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

const topPart = code.substring(0, code.indexOf('export function calculateArrowSignals'));
fs.writeFileSync(file, topPart + newFunctions, 'utf8');
console.log('Cleaned up signalUtils.js!');

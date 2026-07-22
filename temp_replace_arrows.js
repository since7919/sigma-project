const fs = require('fs');
const path = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js';
let code = fs.readFileSync(path, 'utf8');

const startArrowStr = 'export function calculateArrowSignals({ updatedPhases }) {';
const endArrowStr = 'export function calculateCompassSignals({ updatedPhases }) {';

const startArrowIdx = code.indexOf(startArrowStr);
const endArrowIdx = code.indexOf(endArrowStr);

if (startArrowIdx !== -1 && endArrowIdx !== -1) {
  const replacementArrow = `export function calculateArrowSignals({ updatedPhases }) {
  const vehicles = Array.from({ length: 16 }, (_, i) => i + 1);
  const peds = Array.from({ length: 16 }, (_, i) => i + 101);
  const allMovs = [...vehicles, ...peds];

  return allMovs.map(m => {
    const isPed = m >= 100;
    const arrowData = isPed ? { type: 'WALK', ang: 0 } : getVisualArrowLocal(m);
    
    let ang = 0;
    let textRot = 0;
    let radiusMultiplier = 40;

    if (isPed) {
      const refM = m - 100;
      const baseAng = defPosAngles[(refM - 1) % 16] || 0;
      ang = (baseAng - 90 + 360) % 360;
      radiusMultiplier = 48; 
      textRot = ang;
      if (textRot > 90 && textRot < 270) textRot -= 180;
    } else {
      ang = defPosAngles[(m - 1) % 16] || 0;
      if (m % 2 !== 0) ang += 7;
      else ang -= 7;
      radiusMultiplier = (m > 8) ? 55 : 40;
      textRot = arrowData.ang;
    }

    const rad = ang * Math.PI / 180;
    const topPx = 90 - Math.cos(rad) * radiusMultiplier;
    const leftPx = 90 + Math.sin(rad) * radiusMultiplier;

    let signalState = 'off';
    let countdown = 0;

    if (updatedPhases && updatedPhases.length > 0) {
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

`;
  code = code.substring(0, startArrowIdx) + replacementArrow + code.substring(endArrowIdx);
  fs.writeFileSync(path, code, 'utf8');
  console.log('Replaced calculateArrowSignals successfully.');
} else {
  console.log('Could not find start or end index for arrow.');
}

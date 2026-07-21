import sys
with open('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', 'r', encoding='utf-8') as f:
    code = f.read()

start_str = 'export function calculateArrowSignals({'
end_str = 'export function calculateCompassSignals({'

start_idx = code.find(start_str)
end_idx = code.find(end_str)

if start_idx != -1 and end_idx != -1:
    replacement = '''export function calculateArrowSignals({ updatedPhases }) {
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
      const match = updatedPhases.find(p => p.m === m);
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

'''
    with open('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', 'w', encoding='utf-8') as f:
        f.write(code[:start_idx] + replacement + code[end_idx:])
    print('Replaced successfully.')
else:
    print('Could not find start or end index.')

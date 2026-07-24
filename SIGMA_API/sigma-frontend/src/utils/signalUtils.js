export function parsePhaseCode(code) {
  if (!code) return null;
  const typeChar = code.charAt(0).toUpperCase();
  let typeName = '미지정';
  if (typeChar === 'S') typeName = '직진(1)';
  else if (typeChar === 'L') typeName = '좌회전(2)';
  else if (typeChar === 'P') typeName = '보행(3)';
  else return {
    direction: '미지정',
    outputType: '미지정',
    pedestrian: 0,
    bankCode: '',
    timeSignal: 0,
    original: code,
    type: 'U',
    angle: 0
  };

  const enterAngle = parseInt(code.substring(1, 4), 10);
  let dirName = '미지정';
  if (!isNaN(enterAngle)) {
    const angle = enterAngle % 360;
    if (angle >= 332.5 || angle < 27.5) dirName = '북';
    else if (angle >= 27.5 && angle < 62.5) dirName = '북동';
    else if (angle >= 62.5 && angle < 117.5) dirName = '동';
    else if (angle >= 117.5 && angle < 152.5) dirName = '남동';
    else if (angle >= 152.5 && angle < 207.5) dirName = '남';
    else if (angle >= 207.5 && angle < 242.5) dirName = '남서';
    else if (angle >= 242.5 && angle < 297.5) dirName = '서';
    else if (angle >= 297.5 && angle < 332.5) dirName = '북서';
  }

  const dirAngleMap = { '북': 0, '북동': 45, '동': 90, '남동': 135, '남': 180, '남서': 225, '서': 270, '북서': 315 };
  let parsedAngle = dirAngleMap[dirName] !== undefined ? dirAngleMap[dirName] : 0;

  return { 
    direction: dirName, 
    outputType: typeName,
    pedestrian: 0, 
    bankCode: '', 
    timeSignal: 0, 
    original: code,
    type: typeChar,
    angle: parsedAngle
  };
}

export const toHex = (v) => {
  if (v === 0 || v === '0' || !v) return '00';
  if (v === 16 || v === '16' || v === 22 || v === '22') return '10';
  if (v === 32 || v === '32' || v === 50 || v === '50') return '20';
  return typeof v === 'number' ? v.toString(16).padStart(2, '0').toUpperCase() : String(v);
};

export const isCarActive = (v) => {
  const hex = toHex(v);
  return hex === '01' || hex === '10' || hex === '11' || hex === '04' || hex === '05' || hex === '02' || hex === '20';
};

export const isPedActive = (v) => {
  const hex = toHex(v);
  return hex === '01' || hex === '05' || hex === '10' || hex === '20';
};

export const getCellClass = (val, type) => {
  const hex = toHex(val);
  if (hex === '00') return 'cell-gray';
  if (type === 'car') {
    if (hex === '01' || hex === '10' || hex === '11') return 'cell-green';
    if (hex === '02' || hex === '20') return 'cell-yellow';
    if (hex === '08') return 'cell-red';
    if (hex === '04') return 'cell-green';
  } else {
    if (hex === '01' || hex === '10') return 'cell-green';
    if (hex === '08' || hex === '02') return 'cell-red';
    if (hex === '05' || hex === '20') return 'cell-flash';
  }
  const num = parseInt(hex, 16);
  if (num & 0x55) return 'cell-green';
  if (num & 0xAA) return 'cell-yellow';
  return 'cell-red';
};

const defPosAngles = [90, 270, 180, 0, 270, 90, 0, 180, 45, 225, 135, 315, 225, 45, 315, 135];

const getVisualArrowLocal = (m) => {
  if (m <= 0) return { type: '•', ang: 0 };
  if (m >= 100) return { type: 'WALK', ang: 0 };
  const movementMap = {
    1: { type: '↰', ang: 270 }, 2: { type: '↗', ang: 45 },
    3: { type: '↰', ang: 0 }, 4: { type: '↙', ang: 315 },
    5: { type: '↰', ang: 90 }, 6: { type: '↙', ang: 45 },
    7: { type: '↰', ang: 180 }, 8: { type: '↖', ang: 45 },
    9: { type: '↰', ang: 225 }, 10: { type: '↗', ang: 0 },
    11: { type: '↰', ang: 315 }, 12: { type: '↘', ang: 0 },
    13: { type: '↰', ang: 45 }, 14: { type: '↙', ang: 0 },
    15: { type: '↰', ang: 135 }, 16: { type: '↖', ang: 0 }
  };
  return movementMap[m] || { type: '•', ang: 0 };
};


export function calculateArrowSignals({ updatedPhases }) {
  if (!updatedPhases) return [];
  const vehicles = Array.from({ length: 16 }, (_, i) => i + 1);
  const peds = Array.from({ length: 16 }, (_, i) => i + 101);
  const allMovs = [...vehicles, ...peds];

  return allMovs.map(m => {
    const isPed = m >= 100;
    const arrowData = isPed ? { type: 'WALK', ang: 0 } : getVisualArrowLocal(m);
    
    let signalState = 'off';
    let countdown = 0;
    
    const degVal = defPosAngles[(isPed ? (m - 101) : (m - 1)) % 16] || 0;
    const mType = isPed ? 'P' : (m % 2 !== 0 ? 'L' : 'S');
    const match = updatedPhases.find(p => p.angle === degVal && p.type === mType);
    
    let topPx = 90;
    let leftPx = 90;
    
    let textRot = 0;
    if (isPed) {
      const refM = m - 100;
      let baseAng = defPosAngles[(refM - 1) % 16] || 0;
      if (match && match.customAngle !== undefined) baseAng = match.customAngle;
      
      const ang = (baseAng - 90 + 360) % 360;
      const r = 48;
      const rad = (ang - 90) * Math.PI / 180;
      leftPx = 90 + r * Math.cos(rad);
      topPx = 90 + r * Math.sin(rad);
      textRot = ang;
      if (textRot > 90 && textRot < 270) textRot -= 180;
    } else {
      let a = defPosAngles[(m - 1) % 16] || 0;
      if (match && match.customAngle !== undefined) a = match.customAngle;
      
      if (m % 2 !== 0) a += 10;
      else a -= 10;
      
      const r = (m > 8) ? 55 : 40;
      const rad = (a - 90) * Math.PI / 180;
      leftPx = 90 + r * Math.cos(rad);
      topPx = 90 + r * Math.sin(rad);
      
      if (match && match.customAngle !== undefined) {
          textRot = arrowData.ang + (match.customAngle - degVal);
      } else {
          textRot = arrowData.ang;
      }
    }
    
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
    pedCountdown = pResult.countdown;

    let isAnyVehActive = (sigS === 'green' || sigS === 'yellow' || sigS === 'flash' || sigL === 'green' || sigL === 'yellow' || sigL === 'flash');
    let crOn = vehHasData && !isAnyVehActive;
    let cyOn = sigS === 'yellow' || sigL === 'yellow' || sigS === 'flash' || sigL === 'flash';
    let caOn = sigL === 'green';
    let cgOn = sigS === 'green';

    let prOn = sigP === 'red';
    let pgOn = sigP === 'green' || sigP === 'flash';

    let customAngle = deg;
    const allMatches = [...sMatches, ...lMatches, ...pMatches];
    if (allMatches.length > 0 && allMatches[0].customAngle !== undefined) {
      customAngle = allMatches[0].customAngle;
    }

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

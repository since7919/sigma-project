const fs = require('fs');

const fileContent = `export function parsePhaseCode(code) {
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
    if (angle >= 337 || angle < 22) dirName = '북';
    else if (angle >= 22 && angle < 67) dirName = '북동';
    else if (angle >= 67 && angle < 112) dirName = '동';
    else if (angle >= 112 && angle < 157) dirName = '남동';
    else if (angle >= 157 && angle < 202) dirName = '남';
    else if (angle >= 202 && angle < 247) dirName = '남서';
    else if (angle >= 247 && angle < 292) dirName = '서';
    else if (angle >= 292 && angle < 337) dirName = '북서';
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

export function calculateArrowSignals({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, sigMapData, updatedPhases }) {
  if (updatedPhases && updatedPhases.length > 0) {
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
  } else {
    // --- TRUE ORIGINAL LOGIC (Fallback) ---
    const vehicles = Array.from({ length: 16 }, (_, i) => i + 1);
    const peds = Array.from({ length: 16 }, (_, i) => i + 101);
    const allMovs = [...vehicles, ...peds];

    let sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
    if (!isSeoul) {
      const detailData = window.L02_DETAIL_DATA || [];
      const conf = detailData.find(d => String(d.INT_NO) === String(intersection.int_no));
      if (conf) {
        for (let i = 1; i <= 8; i++) {
          ['A', 'B'].forEach(ring => {
            const parsed = parsePhaseCode(conf[\`\${ring}_RING_\${i}_PHASE_CONF_CD\`]);
            if (parsed) {
              const degVal = parsed.angle;
              if (parsed.type === 'S') sPhaseMap[degVal] = { ring, idx: i };
              else if (parsed.type === 'L') lPhaseMap[degVal] = { ring, idx: i };
              else if (parsed.type === 'P') {
                if (!pPhaseMap[degVal]) pPhaseMap[degVal] = [];
                pPhaseMap[degVal].push({ ring, idx: i });
              }
            }
          });
        }
      }
      
      if (cropData) {
        [sPhaseMap, lPhaseMap].forEach(map => {
          Object.entries(map).forEach(([deg, phase]) => {
            const hasPhase = (cropData[\`\${phase.ring}_RING_\${phase.idx}_PHASE_VAL\`] || 0) > 0;
            if (hasPhase) {
              if (!pPhaseMap[deg]) pPhaseMap[deg] = [];
              if (!pPhaseMap[deg].some(p => p.ring === phase.ring && p.idx === phase.idx)) {
                pPhaseMap[deg].push({ ring: phase.ring, idx: phase.idx });
              }
            }
          });
        });
      }
    }

    const checkActive = (phaseMapDict, degVal) => {
      const conf = phaseMapDict[degVal];
      if (!conf) return false;
      const activePhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
      if (conf.idx !== activePhaseIdx) return false;

      if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
        const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
        const currentPhaseVal = cropData ? (cropData[\`\${conf.ring}_RING_\${activePhaseIdx}_PHASE_VAL\`] || 0) : 0;
        const activeSteps = ringData.filter(s => {
          const matchPhase = s.phaseNo === activePhaseIdx;
          let hasActiveVal = false;
          for (let i = 1; i <= 8; i++) {
            if (isCarActive(s[\`car\${i}\`])) hasActiveVal = true;
          }
          return matchPhase && hasActiveVal;
        });
        if (activeSteps.length === 0) return false;
      }
      return true;
    };

    const checkPedActive = (degVal) => {
      const confs = pPhaseMap[degVal];
      if (!confs || confs.length === 0) return false;
      return confs.some(conf => {
        const activePhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
        if (conf.idx !== activePhaseIdx) return false;

        const pedRemain = conf.ring === 'A' ? remainA : remainB;
        if (pedRemain <= 0) return false;

        if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
          const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
          const activeSteps = ringData.filter(s => {
            const matchPhase = s.phaseNo === activePhaseIdx;
            let hasPed = false;
            for (let i = 1; i <= 8; i++) {
              if (isPedActive(s[\`ped\${i}\`])) hasPed = true;
            }
            return matchPhase && hasPed;
          });
          if (activeSteps.length === 0) return false;
        }
        return true;
      });
    };

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
      const leftPx = 90 + radiusMultiplier * Math.cos(rad);
      const topPx = 90 + radiusMultiplier * Math.sin(rad);

      let signalState = 'off';
      let countdown = 0;

      if (isSeoul) {
        const spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
        if (spat && spat.status) {
          const degVal = defPosAngles[(isPed ? (m - 101) : (m - 1)) % 16] || 0;
          const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
          let pfx = '';
          if (degVal === 0) pfx = 'nt';
          else if (degVal === 90) pfx = 'et';
          else if (degVal === 180) pfx = 'st';
          else if (degVal === 270) pfx = 'wt';
          
          if (pfx) {
            const isLeftMov = m % 2 !== 0;
            if (isPed) {
              const state = statObj[pfx + 'PedsgStatNm'];
              const remain = statObj[pfx + 'PedsgRmdrTm'];
              if (state === '보행녹색') {
                signalState = 'G';
                countdown = remain;
              } else if (state === '보행점멸') {
                signalState = 'F';
                countdown = remain;
              }
            } else if (isLeftMov) {
              const state = statObj[pfx + 'LtsgStatNm'];
              const remain = statObj[pfx + 'LtsgRmdrTm'];
              if (state === '녹색') {
                signalState = 'G';
                countdown = remain;
              } else if (state === '황색') {
                signalState = 'Y';
                countdown = remain;
              }
            } else {
              const state = statObj[pfx + 'StsgStatNm'];
              const remain = statObj[pfx + 'StsgRmdrTm'];
              if (state === '녹색') {
                signalState = 'G';
                countdown = remain;
              } else if (state === '황색') {
                signalState = 'Y';
                countdown = remain;
              }
            }
          }
        }
      } else {
        const degVal = defPosAngles[(isPed ? (m - 101) : (m - 1)) % 16] || 0;
        if (isPed) {
          if (checkPedActive(degVal)) {
            const pedRemain = remainA; // Simple ring selection fallback
            signalState = (pedRemain > 0 && pedRemain <= 6) ? 'F' : 'G';
            countdown = pedRemain;
          }
        } else {
          const isLeftMov = m % 2 !== 0;
          const mapToUse = isLeftMov ? lPhaseMap : sPhaseMap;
          if (mapToUse[degVal] && checkActive(mapToUse, degVal)) {
            const conf = mapToUse[degVal];
            const currentPhaseVal = conf.ring === 'A' ? remainA : remainB;
            if (cropData && cropData.cycle > 0) {
              signalState = (currentPhaseVal > 0 && currentPhaseVal <= 4) ? 'Y' : 'G';
              countdown = currentPhaseVal;
            } else {
              signalState = 'F';
            }
          }
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
}

export function calculateCompassSignals({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, sigMapData, updatedPhases }) {
  if (updatedPhases && updatedPhases.length > 0) {
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
      s = sResult.state;
      carCountdown = Math.max(carCountdown, sResult.countdown);

      const lResult = getStatusAndCountdown(lMatches);
      l = lResult.state;
      carCountdown = Math.max(carCountdown, lResult.countdown);

      const pResult = getStatusAndCountdown(pMatches);
      p = pResult.state;
      pedCountdown = Math.max(pedCountdown, pResult.countdown);

      let crOn = s === 'red' || l === 'red';
      let cyOn = s === 'yellow' || l === 'yellow';
      let caOn = l === 'green';
      let cgOn = s === 'green';

      let prOn = p === 'red';
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
  } else {
    // --- TRUE ORIGINAL LOGIC (Fallback) ---
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

    let sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
    if (!isSeoul) {
      const detailData = window.L02_DETAIL_DATA || [];
      const conf = detailData.find(d => String(d.INT_NO) === String(intersection.int_no));
      if (conf) {
        for (let i = 1; i <= 8; i++) {
          ['A', 'B'].forEach(ring => {
            const parsed = parsePhaseCode(conf[\`\${ring}_RING_\${i}_PHASE_CONF_CD\`]);
            if (parsed) {
              const degVal = parsed.angle;
              if (parsed.type === 'S') sPhaseMap[degVal] = { ring, idx: i };
              else if (parsed.type === 'L') lPhaseMap[degVal] = { ring, idx: i };
              else if (parsed.type === 'P') {
                if (!pPhaseMap[degVal]) pPhaseMap[degVal] = [];
                pPhaseMap[degVal].push({ ring, idx: i });
              }
            }
          });
        }
      }
      
      if (cropData) {
        [sPhaseMap, lPhaseMap].forEach(map => {
          Object.entries(map).forEach(([deg, phase]) => {
            const hasPhase = (cropData[\`\${phase.ring}_RING_\${phase.idx}_PHASE_VAL\`] || 0) > 0;
            if (hasPhase) {
              if (!pPhaseMap[deg]) pPhaseMap[deg] = [];
              if (!pPhaseMap[deg].some(p => p.ring === phase.ring && p.idx === phase.idx)) {
                pPhaseMap[deg].push({ ring: phase.ring, idx: phase.idx });
              }
            }
          });
        });
      }
    }

    const checkActive = (phaseMapDict, degVal) => {
      const conf = phaseMapDict[degVal];
      if (!conf) return false;
      const activePhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
      if (conf.idx !== activePhaseIdx) return false;

      if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
        const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
        const activeSteps = ringData.filter(s => {
          const matchPhase = s.phaseNo === activePhaseIdx;
          let hasActiveVal = false;
          for (let i = 1; i <= 8; i++) {
            if (isCarActive(s[\`car\${i}\`])) hasActiveVal = true;
          }
          return matchPhase && hasActiveVal;
        });
        if (activeSteps.length === 0) return false;
      }
      return true;
    };

    const checkPedActive = (degVal) => {
      const confs = pPhaseMap[degVal];
      if (!confs || confs.length === 0) return false;
      return confs.some(conf => {
        const activePhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
        if (conf.idx !== activePhaseIdx) return false;

        const pedRemain = conf.ring === 'A' ? remainA : remainB;
        if (pedRemain <= 0) return false;

        if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
          const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
          const activeSteps = ringData.filter(s => {
            const matchPhase = s.phaseNo === activePhaseIdx;
            let hasPed = false;
            for (let i = 1; i <= 8; i++) {
              if (isPedActive(s[\`ped\${i}\`])) hasPed = true;
            }
            return matchPhase && hasPed;
          });
          if (activeSteps.length === 0) return false;
        }
        return true;
      });
    };

    return directions.map(({ key, deg }) => {
      let s = 'off', l = 'off', p = 'off';
      let carCountdown = 0;
      let pedCountdown = 0;
      let vehHasData = false;
      let pedHasData = false;

      if (isSeoul) {
        const spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
        if (spat && spat.status) {
          const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
          let pfx = '';
          if (deg === 0) pfx = 'nt';
          else if (deg === 90) pfx = 'et';
          else if (deg === 180) pfx = 'st';
          else if (deg === 270) pfx = 'wt';
          
          if (pfx) {
            vehHasData = true;
            pedHasData = true;

            const stState = statObj[pfx + 'StsgStatNm'];
            const stRemain = statObj[pfx + 'StsgRmdrTm'];
            const ltState = statObj[pfx + 'LtsgStatNm'];
            const ltRemain = statObj[pfx + 'LtsgRmdrTm'];
            const pedState = statObj[pfx + 'PedsgStatNm'];
            const pedRemain = statObj[pfx + 'PedsgRmdrTm'];

            if (stState === '녹색') s = 'green';
            else if (stState === '황색') s = 'yellow';
            else s = 'red';
            carCountdown = Math.max(carCountdown, stRemain || 0);

            if (ltState === '녹색') l = 'green';
            else if (ltState === '황색') l = 'yellow';
            else l = 'red';
            carCountdown = Math.max(carCountdown, ltRemain || 0);

            if (pedState === '보행녹색') p = 'green';
            else if (pedState === '보행점멸') p = 'flash';
            else p = 'red';
            pedCountdown = Math.max(pedCountdown, pedRemain || 0);
          }
        }
      } else {
        if (sPhaseMap[deg]) {
          vehHasData = true;
          if (checkActive(sPhaseMap, deg)) {
            const currentPhaseVal = sPhaseMap[deg].ring === 'A' ? remainA : remainB;
            s = (currentPhaseVal > 0 && currentPhaseVal <= 4) ? 'yellow' : 'green';
            carCountdown = Math.max(carCountdown, currentPhaseVal);
          } else {
            s = 'red';
          }
        }
        if (lPhaseMap[deg]) {
          vehHasData = true;
          if (checkActive(lPhaseMap, deg)) {
            const currentPhaseVal = lPhaseMap[deg].ring === 'A' ? remainA : remainB;
            l = (currentPhaseVal > 0 && currentPhaseVal <= 4) ? 'yellow' : 'green';
            carCountdown = Math.max(carCountdown, currentPhaseVal);
          } else {
            l = 'red';
          }
        }
        if (pPhaseMap[deg]) {
          pedHasData = true;
          if (checkPedActive(deg)) {
            const pedRemain = pPhaseMap[deg][0].ring === 'A' ? remainA : remainB;
            p = (pedRemain > 0 && pedRemain <= 6) ? 'flash' : 'green';
            pedCountdown = Math.max(pedCountdown, pedRemain);
          } else {
            p = 'red';
          }
        }
      }

      let crOn = s === 'red' || l === 'red';
      let cyOn = s === 'yellow' || l === 'yellow';
      let caOn = l === 'green';
      let cgOn = s === 'green';

      let prOn = p === 'red';
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
}
`;

fs.writeFileSync('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js', fileContent, 'utf8');
console.log('Successfully wrote exact contents!');

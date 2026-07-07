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

export const getCellClass = (val, type) => {
  const hex = toHex(val);
  if (hex === '00') return 'cell-gray';
  if (type === 'car') {
    if (hex === '01' || hex === '10' || hex === '11') return 'cell-green';
    if (hex === '02' || hex === '20') return 'cell-yellow';
    if (hex === '08') return 'cell-red';
    if (hex === '04') return 'cell-green';
  } else {
    if (hex === '01') return 'cell-green';
    if (hex === '08' || hex === '02') return 'cell-red';
    if (hex === '05') return 'cell-flash';
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

export function calculateArrowSignals({
  intersection,
  isSeoul,
  cropData,
  phaseA,
  phaseB,
  remainA,
  remainB,
  sigMapData
}) {
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
          const parsed = parsePhaseCode(conf[`${ring}_RING_${i}_PHASE_CONF_CD`]);
          if (parsed) {
            const degVal = parsed.angle;
            if (parsed.type === 'S') sPhaseMap[degVal] = { ring, idx: i };
            else if (parsed.type === 'L') lPhaseMap[degVal] = { ring, idx: i };
            else if (parsed.type === 'P') pPhaseMap[degVal] = { ring, idx: i };
          }
        });
      }
    }
    
    // Infer missing pedestrian phases from sigMapData
    if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
      ['A', 'B'].forEach(ring => {
        const ringData = ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
        if (!ringData) return;
        for (let i = 1; i <= 8; i++) {
          const hasPedSignal = ringData.some(step => step[`ped${i}`] === 1 || step[`ped${i}`] === 5);
          if (hasPedSignal) {
            const alreadyMapped = Object.values(pPhaseMap).some(p => p.ring === ring && p.idx === i);
            if (!alreadyMapped) {
              let bestDeg = null;
              let minDiff = 999;
              Object.entries(sPhaseMap).forEach(([deg, sPhase]) => {
                if (sPhase.ring === ring) {
                  const diff = Math.abs(sPhase.idx - i);
                  if (diff < minDiff) {
                    minDiff = diff;
                    bestDeg = Number(deg);
                  }
                }
              });
              if (bestDeg !== null) {
                pPhaseMap[bestDeg] = { ring, idx: i };
              }
            }
          }
        }
      });
    }

    if (String(intersection.int_no) === '1045') {
      pPhaseMap[225] = { ring: 'A', idx: 1 };
    }
  }

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

    if (isSeoul) {
      const degVal = defPosAngles[(isPed ? (m - 101) : (m - 1)) % 16] || 0;
      const degToKey = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
      const key = degToKey[degVal];
      
      let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
      if (spat && spat.status) {
        const prefixMap = { 'N': 'nt', 'NE': 'ne', 'E': 'et', 'SE': 'se', 'S': 'st', 'SW': 'sw', 'W': 'wt', 'NW': 'nw' };
        const pfx = prefixMap[key];
        const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
        const timingObj = Array.isArray(spat.timing) ? (spat.timing[0] || {}) : spat.timing;

        const stsg = statObj[pfx + 'StsgStatNm'];
        const ltsg = statObj[pfx + 'LtsgStatNm'];
        const pdsg = statObj[pfx + 'PdsgStatNm'];

        const stTime = timingObj[pfx + 'StsgRmdrCs'];
        const ltTime = timingObj[pfx + 'LtsgRmdrCs'];
        const pdTime = timingObj[pfx + 'PdsgRmdrCs'];

        if (isPed) {
          if (pdsg === 'protected-Movement-Allowed' || pdsg === 'permissive-Movement-Allowed' || pdsg === '녹색') { 
            signalState = 'G';
            if (pdTime) countdown = Math.floor(pdTime / 10);
          } else if (pdsg === 'protected-clearance' || pdsg === '황색') {
            signalState = 'F';
            if (pdTime) countdown = Math.floor(pdTime / 10);
          }
        } else {
          const isLeftMov = (m % 2 !== 0);
          if (isLeftMov) {
            if (ltsg === 'protected-Movement-Allowed' || ltsg === '녹색화살표') {
              signalState = 'G';
              if (ltTime) countdown = Math.floor(ltTime / 10);
            } else if (ltsg === 'protected-clearance' || ltsg === '황색') {
              signalState = 'Y';
              if (ltTime) countdown = Math.floor(ltTime / 10);
            }
          } else {
            if (stsg === 'protected-Movement-Allowed' || stsg === 'permissive-Movement-Allowed' || stsg === '녹색' || stsg === '녹색화살표' || stsg === '청색') {
              signalState = 'G';
              if (stTime) countdown = Math.floor(stTime / 10);
            } else if (stsg === 'protected-clearance' || stsg === 'permissive-clearance' || stsg === '황색') {
              signalState = 'Y';
              if (stTime) countdown = Math.floor(stTime / 10);
            }
          }
        }
      }
    } else {
      if (cropData) {
        const checkActive = (map, degVal) => {
          const conf = map[degVal];
          if (!conf) return false;
          return conf.ring === 'A' ? (conf.idx === phaseA) : (conf.idx === phaseB);
        };
        const getCountdown = (map, degVal) => {
          const conf = map[degVal];
          if (!conf) return 0;
          return conf.ring === 'A' ? remainA : remainB;
        };

        const degVal = defPosAngles[(isPed ? (m - 101) : (m - 1)) % 16] || 0;
        if (isPed) {
          const pConf = pPhaseMap[degVal];
          if (pConf && checkActive(pPhaseMap, degVal)) {
            const elapsed = pConf.ring === 'A' ? (cropData[`A_RING_${phaseA}_PHASE_VAL`] || 0) - remainA : (cropData[`B_RING_${phaseB}_PHASE_VAL`] || 0) - remainB;
            let pedDuration = getCountdown(pPhaseMap, degVal) + elapsed;
            if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
              const ringData = pConf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
              const activeSteps = ringData.filter(step => step[`ped${pConf.idx}`] === 1 || step[`ped${pConf.idx}`] === 5);
              if (activeSteps.length > 0) {
                pedDuration = activeSteps.reduce((acc, step) => acc + (step.maxTm > 0 ? step.maxTm : step.minTm), 0);
              } else {
                pedDuration = Math.max(0, pedDuration - 5);
              }
            } else {
              pedDuration = Math.max(0, pedDuration - 5);
            }
            const pedRemain = Math.max(0, pedDuration - elapsed);
            if (pedRemain > 0) {
              signalState = pedRemain <= 7 ? 'F' : 'G';
              countdown = pedRemain;
            }
          }
        } else {
          const isLeftMov = (m % 2 !== 0);
          const mapToUse = isLeftMov ? lPhaseMap : sPhaseMap;
          if (mapToUse[degVal] && checkActive(mapToUse, degVal)) {
            let carActive = true;
            if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
              const conf = mapToUse[degVal];
              const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
              const activeSteps = ringData.filter(step => step[`car${conf.idx}`] === 1 || step[`car${conf.idx}`] === 5);
              if (activeSteps.length === 0) carActive = false;
            }
            if (carActive) {
              signalState = 'G';
              countdown = getCountdown(mapToUse, degVal);
              if (countdown <= 3) signalState = 'Y';
            }
          }
        }
      }
    }

    const colorClass = (signalState === 'Y' || signalState === 'F') ? 'yellow' : 'green';

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

export function calculateCompassSignals({
  intersection,
  isSeoul,
  cropData,
  phaseA,
  phaseB,
  remainA,
  remainB,
  sigMapData
}) {
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

  let sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
  let hasConf = false;
  if (!isSeoul) {
    const detailData = window.L02_DETAIL_DATA || [];
    const conf = detailData.find(d => String(d.INT_NO) === String(intersection.int_no));
    if (conf) {
      hasConf = true;
      for (let i = 1; i <= 8; i++) {
        ['A', 'B'].forEach(ring => {
          const parsed = parsePhaseCode(conf[`${ring}_RING_${i}_PHASE_CONF_CD`]);
          if (parsed) {
            if (parsed.type === 'S') sPhaseMap[parsed.angle] = { ring, idx: i };
            else if (parsed.type === 'L') lPhaseMap[parsed.angle] = { ring, idx: i };
            else if (parsed.type === 'P') pPhaseMap[parsed.angle] = { ring, idx: i };
          }
        });
      }
    }
    // Pedestrian mapping inference fallback
    if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
      ['A', 'B'].forEach(ring => {
        const ringData = ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
        if (!ringData) return;
        for (let idx = 1; idx <= 8; idx++) {
          const hasPedSignal = ringData.some(step => step[`ped${idx}`] === 1 || step[`ped${idx}`] === 5);
          if (hasPedSignal) {
            const existingAngle = Object.keys(pPhaseMap).find(k => pPhaseMap[k].ring === ring && pPhaseMap[k].idx === idx);
            if (!existingAngle) {
              const sameRingVehicles = Object.keys(sPhaseMap)
                .filter(k => sPhaseMap[k].ring === ring)
                .map(k => ({ angle: parseInt(k, 10), idx: sPhaseMap[k].idx }));
              if (sameRingVehicles.length > 0) {
                sameRingVehicles.sort((a, b) => Math.abs(a.idx - idx) - Math.abs(b.idx - idx));
                const bestAngle = sameRingVehicles[0].angle;
                pPhaseMap[bestAngle] = { ring, idx };
              }
            }
          }
        }
      });
    }
  }

  return directions.map(({ key, deg }) => {
    let s = 'off', l = 'off', p = 'off';
    let carCountdown = 0;
    let pedCountdown = 0;
    let vehHasData = false;
    let pedHasData = false;

    if (isSeoul) {
      let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
      if (spat && spat.status) {
        const prefixMap = { 'N': 'nt', 'NE': 'ne', 'E': 'et', 'SE': 'se', 'S': 'st', 'SW': 'sw', 'W': 'wt', 'NW': 'nw' };
        const pfx = prefixMap[key];
        const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
        const timingObj = Array.isArray(spat.timing) ? (spat.timing[0] || {}) : spat.timing;

        const stsg = statObj[pfx + 'StsgStatNm'];
        const ltsg = statObj[pfx + 'LtsgStatNm'];
        const pdsg = statObj[pfx + 'PdsgStatNm'];

        const stTime = timingObj[pfx + 'StsgRmdrCs'];
        const ltTime = timingObj[pfx + 'LtsgRmdrCs'];
        const pdTime = timingObj[pfx + 'PdsgRmdrCs'];

        if (stsg && stsg !== 'null' && stsg !== 'unknown') vehHasData = true;
        if (ltsg && ltsg !== 'null' && ltsg !== 'unknown') vehHasData = true;
        if (pdsg && pdsg !== 'null' && pdsg !== 'unknown') pedHasData = true;

        const hasAnySeoulSignal = Object.keys(statObj).some(k => k.endsWith('StatNm') && statObj[k] && statObj[k] !== 'null');
        if (!hasAnySeoulSignal && ['N', 'E', 'S', 'W'].includes(key)) {
          vehHasData = true;
          pedHasData = true;
        }

        let stOn = false, ltOn = false;
        if (stsg === 'protected-Movement-Allowed' || stsg === 'permissive-Movement-Allowed' || stsg === '녹색' || stsg === '녹색화살표' || stsg === '청색') { 
          s = 'green'; 
          stOn = true; 
          if (stTime) carCountdown = Math.max(carCountdown, Math.floor(stTime / 10));
        } else if (stsg === 'protected-clearance' || stsg === 'permissive-clearance' || stsg === '황색') { 
          s = 'yellow'; 
          stOn = true; 
          if (stTime) carCountdown = Math.max(carCountdown, Math.floor(stTime / 10));
        }

        if (ltsg === 'protected-Movement-Allowed' || ltsg === '녹색화살표') { 
          l = 'green'; 
          ltOn = true; 
          if (ltTime) carCountdown = Math.max(carCountdown, Math.floor(ltTime / 10));
        } else if (ltsg === 'protected-clearance' || ltsg === '황색') { 
          l = 'yellow'; 
          ltOn = true; 
          if (ltTime) carCountdown = Math.max(carCountdown, Math.floor(ltTime / 10));
        }

        if (!stOn && !ltOn && (stsg === 'stop-And-Remain' || ltsg === 'stop-And-Remain' || stsg === '적색' || ltsg === '적색' || s === 'off')) { 
          s = 'red'; 
          l = 'red'; 
        }

        if (pdsg === 'protected-Movement-Allowed' || pdsg === 'permissive-Movement-Allowed' || pdsg === '녹색') { 
          p = 'green'; 
          if (pdTime) pedCountdown = Math.max(pedCountdown, Math.floor(pdTime / 10));
        } else if (pdsg === 'protected-clearance' || pdsg === '황색') {
          p = 'flash';
          if (pdTime) pedCountdown = Math.max(pedCountdown, Math.floor(pdTime / 10));
        } else if (pdsg === 'stop-And-Remain' || pdsg === '적색' || p === 'off') { 
          p = 'red'; 
        }
      } else {
        if (['N', 'E', 'S', 'W'].includes(key)) {
          vehHasData = true;
          pedHasData = true;
          s = 'red';
          l = 'red';
          p = 'red';
        }
      }
    } else {
      vehHasData = hasConf && (sPhaseMap[deg] || lPhaseMap[deg]);
      pedHasData = hasConf && !!pPhaseMap[deg];
      if (vehHasData || pedHasData) {
        if (cropData) {
          const getStepsForCurrentPhase = (ring, currentPhase) => {
            const ringData = ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
            if (!ringData || ringData.length === 0) return [];
            let p = 1;
            let stepsInPhase = [];
            for (let step of ringData) {
              if (p === currentPhase) {
                stepsInPhase.push(step);
              }
              if (step.eop === 1) {
                p++;
              }
            }
            return stepsInPhase;
          };

          const checkActiveVeh = (map) => {
            const conf = map[deg];
            if (!conf) return false;
            
            if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
              const currentPhase = conf.ring === 'A' ? phaseA : phaseB;
              const phaseSteps = getStepsForCurrentPhase(conf.ring, currentPhase);
              return phaseSteps.some(step => step[`car${conf.idx}`] === 1 || step[`car${conf.idx}`] === 5);
            }
            return conf.ring === 'A' ? (conf.idx === phaseA) : (conf.idx === phaseB);
          };

          const checkActivePed = (map) => {
            const conf = map[deg];
            if (!conf) return false;

            if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
              const currentPhase = conf.ring === 'A' ? phaseA : phaseB;
              const phaseSteps = getStepsForCurrentPhase(conf.ring, currentPhase);
              return phaseSteps.some(step => step[`ped${conf.idx}`] === 1 || step[`ped${conf.idx}`] === 5);
            }
            return conf.ring === 'A' ? (conf.idx === phaseA) : (conf.idx === phaseB);
          };

          const getCountdown = (map) => {
            const conf = map[deg];
            if (!conf) return 0;
            return conf.ring === 'A' ? remainA : remainB;
          };

          const getInactiveCountdown = (map, isPedSignal = false) => {
            const conf = map[deg];
            if (!conf) return 0;
            const ringPrefix = conf.ring === 'A' ? 'A_RING' : 'B_RING';
            const currentPhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
            const currentRemain = conf.ring === 'A' ? remainA : remainB;
            
            let targetIdx = conf.idx;
            if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
              const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
              let foundTargetPhase = null;
              let p = 1;
              for (let step of ringData) {
                const isActive = isPedSignal 
                  ? (step[`ped${conf.idx}`] === 1 || step[`ped${conf.idx}`] === 5)
                  : (step[`car${conf.idx}`] === 1 || step[`car${conf.idx}`] === 5);
                if (isActive) {
                  foundTargetPhase = p;
                  break;
                }
                if (step.eop === 1) p++;
              }
              if (foundTargetPhase !== null) {
                targetIdx = foundTargetPhase;
              }
            }

            let sumTime = currentRemain;
            let step = currentPhaseIdx;
            
            let loopCount = 0;
            while (step !== targetIdx && loopCount < 8) {
              step = (step % 8) + 1; 
              const split = cropData[`${ringPrefix}_${step}_PHASE_VAL`] || 0;
              sumTime += split;
              loopCount++;
            }
            return sumTime;
          };

          if (checkActiveVeh(sPhaseMap)) { 
            s = 'green'; 
            carCountdown = Math.max(carCountdown, getCountdown(sPhaseMap)); 
          } else if (sPhaseMap[deg]) {
            carCountdown = Math.max(carCountdown, getInactiveCountdown(sPhaseMap, false));
          }

          if (checkActiveVeh(lPhaseMap)) { 
            l = 'green'; 
            carCountdown = Math.max(carCountdown, getCountdown(lPhaseMap)); 
          } else if (lPhaseMap[deg] && !checkActiveVeh(sPhaseMap)) {
            carCountdown = Math.max(carCountdown, getInactiveCountdown(lPhaseMap, false));
          }

          const calcPedestrian = (conf, map) => {
            const phaseIdx = conf.idx;
            const currentPhase = conf.ring === 'A' ? phaseA : phaseB;
            const elapsed = conf.ring === 'A' ? (cropData[`A_RING_${phaseA}_PHASE_VAL`] || 0) - remainA : (cropData[`B_RING_${phaseB}_PHASE_VAL`] || 0) - remainB;
            let pedDuration = getCountdown(map) + elapsed;
            
            if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
              const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
              const phaseSteps = getStepsForCurrentPhase(conf.ring, currentPhase);
              const activeSteps = phaseSteps.filter(step => step[`ped${phaseIdx}`] === 1 || step[`ped${phaseIdx}`] === 5);
              if (activeSteps.length > 0) {
                pedDuration = activeSteps.reduce((acc, step) => acc + (step.maxTm > 0 ? step.maxTm : step.minTm), 0);
              } else {
                pedDuration = Math.max(0, pedDuration - 5);
              }
            } else {
              pedDuration = Math.max(0, pedDuration - 5);
            }
            const pedRemain = Math.max(0, pedDuration - elapsed);

            if (pedRemain > 0) {
              p = pedRemain <= 7 ? 'flash' : 'green';
              pedCountdown = Math.max(pedCountdown, pedRemain);
            } else {
              p = 'red';
            }
          };

          if (checkActivePed(pPhaseMap)) { 
            calcPedestrian(pPhaseMap[deg], pPhaseMap);
          } else if (pPhaseMap[deg]) {
            p = 'red';
            pedCountdown = Math.max(pedCountdown, getInactiveCountdown(pPhaseMap, true));
          }
        }

        if (s === 'green' && carCountdown <= 3) s = 'yellow';
        if (l === 'green' && carCountdown <= 3) l = 'yellow';
        if (p === 'green' && pedCountdown > 0 && pedCountdown <= 7) p = 'flash';

        if (s === 'off' && l === 'off' && (sPhaseMap[deg] || lPhaseMap[deg])) { s = 'red'; l = 'red'; }
        if (p === 'off' && pPhaseMap[deg]) { p = 'red'; }
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

    const directionLabels = {
      'N': '북', 'E': '동', 'S': '남', 'W': '서',
      'NE': '북동', 'SE': '남동', 'SW': '남서', 'NW': '북서'
    };
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

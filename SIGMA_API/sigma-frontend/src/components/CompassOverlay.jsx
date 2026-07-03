import React from 'react';
import { parsePhaseCode } from '../utils/signalUtils';

export default function CompassOverlay({ intersection, cropData, phaseA, phaseB, remainA, remainB, isSeoul, sigMapData, displayMode }) {
  // 만약 화살표 모드라면, 16방향 및 보행용 101-116 화살표를 링 위에 렌더링
  if (displayMode === 'arrow') {
    const vehicles = Array.from({ length: 16 }, (_, i) => i + 1);
    const peds = Array.from({ length: 16 }, (_, i) => i + 101);
    const allMovs = [...vehicles, ...peds];

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

    const sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
    const detailData = window.L02_DETAIL_DATA || [];
    const conf = !isSeoul ? detailData.find(d => String(d.INT_NO) === String(intersection.int_no)) : null;

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
    if (String(intersection.int_no) === '1045') {
      pPhaseMap[225] = { ring: 'A', idx: 1 };
    }

    const htmlContent = allMovs.map(m => {
      const isPed = m >= 100;
      const arrowData = isPed ? { type: 'WALK', ang: 0 } : getVisualArrowLocal(m);

      let ang = 0;
      if (isPed) {
        const refM = m - 100;
        ang = defPosAngles[(refM - 1) % 16] || 0;
        if (refM % 2 !== 0) ang += 22;
        else ang -= 22;
      } else {
        ang = defPosAngles[(m - 1) % 16] || 0;
        if (m % 2 !== 0) ang += 7;
        else ang -= 7;
      }

      const rad = ang * Math.PI / 180;
      const radiusMultiplier = isPed ? 70 : ((m > 8) ? 55 : 40);
      const topPx = 77.5 - Math.cos(rad) * radiusMultiplier;
      const leftPx = 77.5 + Math.sin(rad) * radiusMultiplier;

      let signalState = 'off';
      let countdown = 0;

      if (isSeoul) {
        const dirKeys = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const refIdx = isPed ? Math.floor((m - 101) / 2) : Math.floor((m - 1) / 2);
        const key = dirKeys[refIdx % 8];
        
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
              signalState = 'G';
              countdown = getCountdown(mapToUse, degVal);
              if (countdown <= 3) signalState = 'Y';
            }
          }
        }
      }

      if (signalState === 'off') return null;

      const colorClass = (signalState === 'Y' || signalState === 'F') ? 'yellow' : 'green';
      const isPedOnly = isPed;

      return (
        <div key={`ms-arrow-${m}`} className="signal-slot" style={{ position: 'absolute', top: `${topPx}px`, left: `${leftPx}px`, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10000 }}>
          <div className={`signal-arrow ${colorClass} ${isPedOnly ? 'walk-mode' : ''}`} style={{ transform: `rotate(${arrowData.ang}deg)`, fontWeight: 800, fontSize: isPedOnly ? '10px' : '20px', lineHeight: 1, color: colorClass === 'yellow' ? '#ffeb3b' : '#00ffbb' }}>
            {isPedOnly ? 'WALK' : arrowData.type}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '9px', fontWeight: 'bold', color: colorClass === 'yellow' ? '#f59e0b' : '#00ffa2', textShadow: '0 0 3px #000, 0 0 5px #000', marginTop: '1px', lineHeight: 1 }}>
            {countdown > 0 ? `${countdown}s` : ''}
          </div>
        </div>
      );
    });

    return (
      <div className="compass-center-overlay-wrapper" style={{ position: 'absolute', top: '50%', left: '50%', width: '180px', height: '180px', pointerEvents: 'none', zIndex: 9999, transform: 'translate(-50%, -50%)', zoom: 'var(--compass-scale-115, 1.15)', transformOrigin: 'center' }}>
        <div className="compass-center-overlay" style={{ background: 'none', border: 'none', boxShadow: 'none' }}>
          {htmlContent}
        </div>
      </div>
    );
  }

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

  // TSI 원본 설정 데이터 활용
  const detailData = window.L02_DETAIL_DATA || [];
  const conf = !isSeoul ? detailData.find(d => String(d.INT_NO) === String(intersection.int_no)) : null;

  let sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
  const hasConf = !!conf;

  if (conf) {
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

    if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
      Object.keys(sPhaseMap).forEach(angle => {
        const sConf = sPhaseMap[angle];
        const ringData = sConf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
        const hasPedSignal = ringData.some(step => step[`ped${sConf.idx}`] === 1 || step[`ped${sConf.idx}`] === 5);
        if (hasPedSignal && !pPhaseMap[angle]) {
          pPhaseMap[angle] = { ring: sConf.ring, idx: sConf.idx };
        }
      });
    }
  }

  return (
    <div className="compass-center-overlay-wrapper" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '180px',
      height: '180px',
      pointerEvents: 'none',
      zIndex: 9999,
      transform: 'translate(-50%, -50%)',
      zoom: 'var(--compass-scale-115, 1.15)',
      transformOrigin: 'center'
    }}>
      <div className="compass-center-overlay">
        {directions.map(({ key, deg }) => {
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
            if (!vehHasData && !pedHasData) return null;

            if (cropData) {
              const checkActive = (map) => {
                const conf = map[deg];
                if (!conf) return false;
                return conf.ring === 'A' ? (conf.idx === phaseA) : (conf.idx === phaseB);
              };
              const getCountdown = (map) => {
                const conf = map[deg];
                if (!conf) return 0;
                return conf.ring === 'A' ? remainA : remainB;
              };

              // 활성화되지 않았을 때(적색)의 잔여 시간 계산 도우미
              const getInactiveCountdown = (map) => {
                const conf = map[deg];
                if (!conf) return 0;
                const ringPrefix = conf.ring === 'A' ? 'A_RING' : 'B_RING';
                const currentPhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
                const currentRemain = conf.ring === 'A' ? remainA : remainB;
                const targetIdx = conf.idx;
                
                let sumTime = currentRemain;
                let step = currentPhaseIdx;
                
                // 현재 스텝(phaseIdx)에서 목표 스텝(idx)까지 순환하여 시간을 더함
                while (step !== targetIdx) {
                  step = (step % 8) + 1; // 1~8 스텝 순환
                  const split = cropData[`${ringPrefix}_${step}_PHASE_VAL`] || 0;
                  sumTime += split;
                }
                return sumTime;
              };

              if (checkActive(sPhaseMap)) { 
                s = 'green'; 
                carCountdown = Math.max(carCountdown, getCountdown(sPhaseMap)); 
              } else if (sPhaseMap[deg]) {
                carCountdown = Math.max(carCountdown, getInactiveCountdown(sPhaseMap));
              }

              if (checkActive(lPhaseMap)) { 
                l = 'green'; 
                carCountdown = Math.max(carCountdown, getCountdown(lPhaseMap)); 
              } else if (lPhaseMap[deg] && !checkActive(sPhaseMap)) {
                // 직진이 켜져있을 땐 직진 잔여시간을 우선으로 보여주고, 둘다 꺼져있을 땐 적색 잔여시간 대입
                carCountdown = Math.max(carCountdown, getInactiveCountdown(lPhaseMap));
              }

              const calcPedestrian = (conf, map) => {
                const phaseIdx = conf.idx;
                const elapsed = conf.ring === 'A' ? (cropData[`A_RING_${phaseA}_PHASE_VAL`] || 0) - remainA : (cropData[`B_RING_${phaseB}_PHASE_VAL`] || 0) - remainB;
                let pedDuration = getCountdown(map) + elapsed;
                
                if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
                  const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                  const activeSteps = ringData.filter(step => step[`ped${phaseIdx}`] === 1 || step[`ped${phaseIdx}`] === 5);
                  if (activeSteps.length > 0) {
                    pedDuration = activeSteps.reduce((acc, step) => acc + (step.maxTm > 0 ? step.maxTm : step.minTm), 0);
                  } else {
                    // SigMap은 있으나 해당 보행 현시 데이터가 없는 경우 휴리스틱 (차량보다 5초 일찍 종료)
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

              if (checkActive(pPhaseMap)) { 
                calcPedestrian(pPhaseMap[deg], pPhaseMap);
              } else if (pPhaseMap[deg]) {
                p = 'red';
                pedCountdown = Math.max(pedCountdown, getInactiveCountdown(pPhaseMap));
              }
            }

            if (s === 'green' && carCountdown <= 3) s = 'yellow';
            if (l === 'green' && carCountdown <= 3) l = 'yellow';
            if (p === 'green' && pedCountdown > 0 && pedCountdown <= 7) p = 'flash';

            if (s === 'off' && l === 'off' && (sPhaseMap[deg] || lPhaseMap[deg])) { s = 'red'; l = 'red'; }
            if (p === 'off' && pPhaseMap[deg]) { p = 'red'; }
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

          return (
            <div key={key} className={`signal-slot slot-${key}`} id={`slot-${key}`}>
              {vehHasData && (
                <div className="signal-mount-frame" id={`veh-block-${key}`}>
                  <div className="component-block">
                    <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 'bold', marginBottom: '2px', textAlign: 'center', textShadow: '0 0 3px #000', whiteSpace: 'nowrap' }}>
                      {dirLabel} {carCountdown > 0 ? <span style={{color: carColor}}>{carCountdown}s</span> : null}
                    </div>
                    <div className="car-housing-box">
                      <div className={`lens c-red ${crOn ? 'on' : ''}`}></div>
                      <div className={`lens c-yellow ${cyOn ? 'on' : ''}`}></div>
                      <div className={`lens c-arrow ${caOn ? 'on' : ''}`}></div>
                      <div className={`lens c-green ${cgOn ? 'on' : ''}`}></div>
                    </div>
                  </div>
                </div>
              )}
              {pedHasData && (
                <div className="ped-mount-container">
                  <div className="ped-mount-frame" id={`ped-block-${key}`}>
                    <div className="ped-housing-box">
                      <div className={`ped-lens p-red ${prOn ? 'on' : ''}`}></div>
                      <div className={`ped-lens p-green ${pgOn ? 'on' : ''}`}></div>
                    </div>
                    <div className="micro-timer ped-timer" style={{color: pedColor}}>{pedCountdown > 0 ? `${pedCountdown}s` : '-'}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

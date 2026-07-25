import { useMemo } from 'react';
import { parsePhaseCode, isCarActive, isPedActive, toHex } from '../utils/signalUtils';

export function useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData, sigMapDataList, customAngles = {} }) {
  return useMemo(() => {
    const activeSigMapList = sigMapDataList && sigMapDataList.length > 0 ? sigMapDataList : (sigMapData ? [sigMapData] : []);
    const intersectionConf = isSeoul ? null : (() => {
      const detailData = window.L02_DETAIL_DATA || [];
      return detailData.find(d => String(d.INT_NO) === String(intersection.int_no)) || null;
    })();
    let phases = [];

    const getPhaseNoForStep = (stepIndex, plan) => {
      let phaseNo = 1;
      for (let i = 0; i < stepIndex; i++) {
        const eopA = plan.ringA[i]?.eop || 0;
        const eopB = plan.ringB[i]?.eop || 0;
        if (eopA === 1 || eopB === 1) phaseNo++;
      }
      return phaseNo;
    };

    if (isSeoul) {
      // (Keep existing Seoul logic intact)
      let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
      if (spat && spat.status) {
        const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
        const prefixMap = { 'nt': '북', 'ne': '북동', 'et': '동', 'se': '남동', 'st': '남', 'sw': '남서', 'wt': '서', 'nw': '북서' };
        const angleMap = { 'nt': 0, 'ne': 45, 'et': 90, 'se': 135, 'st': 180, 'sw': 225, 'wt': 270, 'nw': 315 };
        
        Object.entries(prefixMap).forEach(([pfx, dirKor]) => {
          if (statObj[pfx + 'StsgStatNm'] !== undefined && statObj[pfx + 'StsgStatNm'] !== null) {
            phases.push({ direction: dirKor, outputType: '직진(1)', pedestrian: 0, type: 'S', angle: angleMap[pfx], pfx: pfx });
          }
          if (statObj[pfx + 'LtsgStatNm'] !== undefined && statObj[pfx + 'LtsgStatNm'] !== null) {
            phases.push({ direction: dirKor, outputType: '좌회전(2)', pedestrian: 0, type: 'L', angle: angleMap[pfx], pfx: pfx });
          }
          if (statObj[pfx + 'PdsgStatNm'] !== undefined && statObj[pfx + 'PdsgStatNm'] !== null) {
            phases.push({ direction: dirKor, outputType: '보행(3)', pedestrian: 0, type: 'P', angle: angleMap[pfx], pfx: pfx });
          }
        });
      }
    } else if (intersectionConf) {
      // 1. Parse Vehicle Phases from L02
      phases = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, idx) => {
        const aPhase = parsePhaseCode(intersectionConf[`A_RING_${idx}_PHASE_CONF_CD`]);
        const bPhase = parsePhaseCode(intersectionConf[`B_RING_${idx}_PHASE_CONF_CD`]);
        if (aPhase) acc.push({ ...aPhase, ring: 'A', idx }); // idx is Phase No
        if (bPhase) acc.push({ ...bPhase, ring: 'B', idx }); // idx is Phase No
        return acc;
      }, []);

      // 2. Link Vehicle Phases to LSU Indices by scanning SigMap
      phases.forEach(vPhase => {
        if (vPhase.type !== 'S' && vPhase.type !== 'L') return;
        let foundLsuIdx = -1;
        activeSigMapList.forEach(plan => {
          const ringData = vPhase.ring === 'A' ? plan.ringA : plan.ringB;
          for (let i = 0; i < ringData.length; i++) {
            if (getPhaseNoForStep(i, plan) === vPhase.idx) {
              for (let x = 1; x <= 8; x++) {
                const hex = toHex(ringData[i][`car${x}`]);
                if (vPhase.type === 'S' && (hex === '01' || hex === '20')) { foundLsuIdx = x; break; }
                if (vPhase.type === 'L' && (hex === '10' || hex === '11')) { foundLsuIdx = x; break; }
              }
            }
            if (foundLsuIdx !== -1) break;
          }
        });
        vPhase.lsuIdx = foundLsuIdx !== -1 ? foundLsuIdx : vPhase.idx; // Fallback to Phase No
      });

      // 3. Infer Pedestrian Phases from SigMap
      if (activeSigMapList.length > 0) {
        ['A', 'B'].forEach(ring => {
          for (let lsuIdx = 1; lsuIdx <= 8; lsuIdx++) {
            let pedActivePhases = new Set();
            activeSigMapList.forEach(plan => {
              const planRingData = ring === 'A' ? plan.ringA : plan.ringB;
              for (let i = 0; i < planRingData.length; i++) {
                if (isPedActive(planRingData[i][`ped${lsuIdx}`])) {
                  pedActivePhases.add(getPhaseNoForStep(i, plan));
                }
              }
            });

            if (pedActivePhases.size > 0) {
              let targetAngle = null;
              let targetExactAngle = null;
              let targetDirection = null;

              // Find angle from vehicle with SAME lsuIdx
              const findAngleByLsu = (searchRing) => {
                return phases.find(p => (p.type === 'S' || p.type === 'L') && p.ring === searchRing && p.lsuIdx === lsuIdx);
              };

              let vMatch = findAngleByLsu(ring); // Same ring
              if (!vMatch) vMatch = findAngleByLsu(ring === 'A' ? 'B' : 'A'); // Other ring

              if (vMatch) {
                targetAngle = vMatch.angle;
                targetExactAngle = vMatch.exactAngle;
                targetDirection = vMatch.direction;
              } else {
                // Fallback fixed mapping
                const fbMap = { 1: 0, 2: 90, 3: 180, 4: 270, 5: 45, 6: 135, 7: 225, 8: 315 };
                const fbDirMap = { 1: '북', 2: '동', 3: '남', 4: '서', 5: '북동', 6: '남동', 7: '남서', 8: '북서' };
                targetAngle = fbMap[lsuIdx] || 0;
                targetExactAngle = fbMap[lsuIdx] || 0;
                targetDirection = fbDirMap[lsuIdx] || '북';
              }

              pedActivePhases.forEach(phaseNo => {
                phases.push({
                  direction: targetDirection,
                  outputType: '보행(3)',
                  pedestrian: 0,
                  type: 'P',
                  angle: targetAngle,
                  exactAngle: targetExactAngle,
                  ring: ring,
                  idx: phaseNo,
                  lsuIdx: lsuIdx,
                  inferred: true
                });
              });
            }
          }
        });
      }
    }

    // Apply custom angles
    const angleToPfxMap = {
      0: 'nt', 45: 'ne', 90: 'et', 135: 'se',
      180: 'st', 225: 'sw', 270: 'wt', 315: 'nw'
    };
    phases.forEach(p => {
      const pfx = p.pfx || angleToPfxMap[p.angle];
      p.customAngle = p.exactAngle !== undefined ? p.exactAngle : p.angle;
      if (pfx && customAngles[pfx] !== undefined) {
        p.customAngle = Number(customAngles[pfx]);
      }
    });

    const uniqueMovementsMap = new Map();
    // (Deduplication Logic)
    if (activeSigMapList.length > 0 && !isSeoul) {
      const validPedAngles = new Set(phases.filter(p => p.type === 'P' && p.inferred).map(p => p.angle));
      phases = phases.filter(p => {
        if (p.type === 'P' && !p.inferred) return !validPedAngles.has(p.angle);
        return true;
      });
    }

    phases.forEach(p => {
      const key = `${p.angle}_${p.type}`;
      if (!uniqueMovementsMap.has(key)) {
        uniqueMovementsMap.set(key, { ...p, confs: [] });
      }
      uniqueMovementsMap.get(key).confs.push(p);
    });

    const mapped = Array.from(uniqueMovementsMap.values()).map(m => {
      let isGreen = false;
      let statText = '소등';
      let statClass = 'sig-status-gray';
      let remaining = '-';
      let displayTime = '-';

      if (isSeoul) {
        // (Seoul rendering logic remains identical)
        let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
        let pfx = '';
        if (m.angle === 0) pfx = 'nt';
        else if (m.angle === 45) pfx = 'ne';
        else if (m.angle === 90) pfx = 'et';
        else if (m.angle === 135) pfx = 'se';
        else if (m.angle === 180) pfx = 'st';
        else if (m.angle === 225) pfx = 'sw';
        else if (m.angle === 270) pfx = 'wt';
        else if (m.angle === 315) pfx = 'nw';

        if (spat && spat.status && pfx) {
          const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
          const timingObj = Array.isArray(spat.timing) ? (spat.timing[0] || {}) : spat.timing;
          
          let field = pfx + 'StsgStatNm';
          let timeField = pfx + 'StsgRmdrCs';
          if (m.type === 'L') { field = pfx + 'LtsgStatNm'; timeField = pfx + 'LtsgRmdrCs'; }
          if (m.type === 'P') { field = pfx + 'PdsgStatNm'; timeField = pfx + 'PdsgRmdrCs'; }
          
          const val = statObj[field];
          const remVal = timingObj[timeField];
          const parseRemVal = (v) => (v !== undefined && v !== null && v < 36000) ? (Math.floor(v / 10) + 's') : '-';
          
          if (val === 'protected-Movement-Allowed' || val === 'permissive-Movement-Allowed' || val === '녹색' || val === '녹색화살표' || val === '청색') {
            isGreen = true;
            statText = m.type === 'P' ? '녹색 점등(3)' : '녹색 점등(3)';
            statClass = 'sig-status-green';
            remaining = parseRemVal(remVal);
          } else if (val === 'stop-And-Remain' || val === '적색') {
            statText = m.type === 'P' ? '적색 점등(1)' : '적색 점등(1)';
            statClass = 'sig-status-red';
            remaining = parseRemVal(remVal);
          } else if (val === 'protected-clearance' || val === 'permissive-clearance' || val === '황색' || val === '적-황색') {
            statText = m.type === 'P' ? '보행 점멸(3)' : '황색 점등(2)';
            statClass = m.type === 'P' ? 'sig-status-flash' : 'sig-status-yellow';
            remaining = parseRemVal(remVal);
          }
        }
      } else {
        if (cropData && m.confs.length > 0) {
          const getStepsForCurrentPhase = (ring, currentPhase) => {
            const ringData = ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
            if (!ringData || ringData.length === 0) return [];
            let p = 1;
            let stepsInPhase = [];
            for (let step of ringData) {
              if (p === currentPhase) stepsInPhase.push(step);
              if (step.eop === 1) p++;
            }
            return stepsInPhase;
          };

          // Find if this movement is active in the CURRENT phase
          const activeConf = m.confs.find(phaseConf => {
            const currentPhase = phaseConf.ring === 'A' ? phaseA : phaseB;
            return phaseConf.idx === currentPhase;
          });

          const cycle = cropData.cycle || 0;

          const getPedDuration = (phaseConf) => {
            const currentPhase = phaseConf.ring === 'A' ? phaseA : phaseB;
            let pedDur = cropData[`${phaseConf.ring}_RING_${currentPhase}_PHASE_VAL`] || 0;
            if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
              const phaseSteps = getStepsForCurrentPhase(phaseConf.ring, currentPhase);
              const activeSteps = phaseSteps.filter(stepObj => isPedActive(stepObj[`ped${phaseConf.lsuIdx}`]));
              if (activeSteps.length > 0) {
                pedDur = activeSteps.reduce((acc, stepObj) => acc + (stepObj.maxTm > 0 ? stepObj.maxTm : stepObj.minTm), 0);
              } else {
                pedDur = Math.max(0, pedDur - 5);
              }
            } else {
              pedDur = Math.max(0, pedDur - 5);
            }
            return pedDur;
          };

          let isRed = true;

          if (cycle === 0) {
            isGreen = false;
            statText = '점멸/소등';
            statClass = 'sig-status-flash';
            remaining = '-';
            displayTime = '-';
          } else {
            if (activeConf) {
              const ringPrefix = activeConf.ring === 'A' ? 'A_RING' : 'B_RING';
              const currentPhase = activeConf.ring === 'A' ? phaseA : phaseB;
              const remainingTime = activeConf.ring === 'A' ? remainA : remainB;
              
              // Calculate contiguous time for multi-phase movements
              let totalRemain = remainingTime;
              let nextPhase = (currentPhase % 8) + 1;
              let loopCnt = 0;
              while (m.confs.some(c => c.ring === activeConf.ring && c.idx === nextPhase) && loopCnt < 8) {
                totalRemain += (cropData[`${ringPrefix}_${nextPhase}_PHASE_VAL`] || 0);
                nextPhase = (nextPhase % 8) + 1;
                loopCnt++;
              }

              if (m.type === 'P') {
                const phaseVal = cropData[`${ringPrefix}_${currentPhase}_PHASE_VAL`] || 0;
                const elapsed = phaseVal - remainingTime;
                const pedDuration = getPedDuration(activeConf);
                const pedRemain = Math.max(0, pedDuration - elapsed);

                if (pedRemain > 0) {
                  isRed = false;
                  isGreen = true;
                  if (pedRemain <= 7) {
                    statText = '보행 점멸(3)';
                    statClass = 'sig-status-flash';
                    displayTime = Math.min(pedDuration, 7) + 's';
                    remaining = pedRemain + 's';
                  } else {
                    statText = '녹색 점등(3)';
                    statClass = 'sig-status-green';
                    displayTime = Math.max(0, pedDuration - 7) + 's';
                    remaining = (pedRemain - 7) + 's';
                  }
                }
              } else {
                isRed = false;
                isGreen = true;
                if (totalRemain <= 3) {
                  statText = '황색 점등(2)';
                  statClass = 'sig-status-yellow';
                  displayTime = '3s';
                  remaining = totalRemain + 's';
                } else {
                  statText = '녹색 점등(3)';
                  statClass = 'sig-status-green';
                  displayTime = Math.max(0, totalRemain - 3) + 's';
                  remaining = (totalRemain - 3) + 's';
                }
              }
            }

            if (isRed) {
              isGreen = false;
              statText = m.type === 'P' ? '적색 점등(1)' : '적색 점등(1)';
              statClass = 'sig-status-red';

              let minRedRemain = Infinity;
              for (const phaseConf of m.confs) {
                const ringPrefix = phaseConf.ring === 'A' ? 'A_RING' : 'B_RING';
                const currentPhaseIdx = phaseConf.ring === 'A' ? phaseA : phaseB;
                const currentRemain = phaseConf.ring === 'A' ? remainA : remainB;
                let targetIdx = phaseConf.idx;
                
                let sumTime = 0;
                if (currentPhaseIdx === targetIdx) {
                  const phaseVal = cropData[`${ringPrefix}_${targetIdx}_PHASE_VAL`] || 0;
                  const elapsed = phaseVal - currentRemain;
                  sumTime = cycle - elapsed;
                } else {
                  sumTime = currentRemain;
                  let currStep = currentPhaseIdx;
                  let loopCount = 0;
                  while (currStep !== targetIdx && loopCount < 8) {
                    currStep = (currStep % 8) + 1;
                    if (currStep === targetIdx) break;
                    sumTime += (cropData[`${ringPrefix}_${currStep}_PHASE_VAL`] || 0);
                    loopCount++;
                  }
                }
                if (sumTime < minRedRemain) minRedRemain = sumTime;
              }

              remaining = minRedRemain + 's';

              let ringTotals = { A: 0, B: 0 };
              for (const phaseConf of m.confs) {
                const ringPrefix = phaseConf.ring === 'A' ? 'A_RING' : 'B_RING';
                if (m.type === 'P') {
                  ringTotals[phaseConf.ring] += getPedDuration(phaseConf);
                } else {
                  ringTotals[phaseConf.ring] += (cropData[`${ringPrefix}_${phaseConf.idx}_PHASE_VAL`] || 0);
                }
              }
              let totalActive = Math.max(ringTotals.A, ringTotals.B);
              displayTime = Math.max(0, cycle - totalActive) + 's';
            }
          }
        }
      }

      return {
        ...m,
        isGreen,
        remaining,
        displayTime,
        statusText: statText,
        statusClass: statClass
      };
    });

    return {
      unique: mapped.sort((a, b) => {
        if (a.angle !== b.angle) return a.angle - b.angle;
        const typeWeight = { 'S': 1, 'L': 2, 'P': 3 };
        const weightA = typeWeight[a.type] || 4;
        const weightB = typeWeight[b.type] || 4;
        return weightA - weightB;
      }),
      all: phases
    };
  }, [intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData, customAngles]);
}

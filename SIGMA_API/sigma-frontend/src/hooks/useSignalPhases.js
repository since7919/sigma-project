import { useMemo } from 'react';
import { parsePhaseCode, isCarActive, isPedActive } from '../utils/signalUtils';

export function useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData, sigMapDataListLocal }) {
    return useMemo(() => {
    const sigMapDataListLocal = sigMapDataListLocal && sigMapDataListLocal.length > 0 ? sigMapDataListLocal : (sigMapData ? [sigMapData] : []);
    const conf = isSeoul ? null : (() => {
      const detailData = window.L02_DETAIL_DATA || [];
      return detailData.find(d => String(d.INT_NO) === String(intersection.int_no)) || null;
    })();
    let phases = [];

    if (isSeoul) {
      let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
      if (spat && spat.status) {
        const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
        const prefixMap = { 'nt': '북', 'ne': '북동', 'et': '동', 'se': '남동', 'st': '남', 'sw': '남서', 'wt': '서', 'nw': '북서' };
        const angleMap = { 'nt': 0, 'ne': 45, 'et': 90, 'se': 135, 'st': 180, 'sw': 225, 'wt': 270, 'nw': 315 };
        
        Object.entries(prefixMap).forEach(([pfx, dirKor]) => {
          if (statObj[pfx + 'StsgStatNm'] !== undefined && statObj[pfx + 'StsgStatNm'] !== null) {
            phases.push({
              direction: dirKor,
              outputType: '직진(1)',
              pedestrian: 0,
              type: 'S',
              angle: angleMap[pfx],
              pfx: pfx
            });
          }
          if (statObj[pfx + 'LtsgStatNm'] !== undefined && statObj[pfx + 'LtsgStatNm'] !== null) {
            phases.push({
              direction: dirKor,
              outputType: '좌회전(2)',
              pedestrian: 0,
              type: 'L',
              angle: angleMap[pfx],
              pfx: pfx
            });
          }
          if (statObj[pfx + 'PdsgStatNm'] !== undefined && statObj[pfx + 'PdsgStatNm'] !== null) {
            phases.push({
              direction: dirKor,
              outputType: '보행(3)',
              pedestrian: 0,
              type: 'P',
              angle: angleMap[pfx],
              pfx: pfx
            });
          }
        });
      }
    } else if (conf) {
      phases = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, idx) => {
        const aPhase = parsePhaseCode(conf[`A_RING_${idx}_PHASE_CONF_CD`]);
        const bPhase = parsePhaseCode(conf[`B_RING_${idx}_PHASE_CONF_CD`]);
        if (aPhase) acc.push({ ...aPhase, ring: 'A', idx });
        if (bPhase) acc.push({ ...bPhase, ring: 'B', idx });
        return acc;
      }, []);

      if (cropData) {
        const vehiclePhases = phases.filter(p => p.type === 'S' || p.type === 'L');
        vehiclePhases.forEach(vPhase => {
          const hasPhase = (cropData[`${vPhase.ring}_RING_${vPhase.idx}_PHASE_VAL`] || 0) > 0;
          if (hasPhase) {
            const existingPed = phases.find(p => p.type === 'P' && p.ring === vPhase.ring && p.idx === vPhase.idx);
            if (!existingPed) {
              const uPhaseIndex = phases.findIndex(p => p.type === 'U' && p.ring === vPhase.ring && p.idx === vPhase.idx);
              if (uPhaseIndex !== -1) {
                phases[uPhaseIndex].type = 'P';
                phases[uPhaseIndex].outputType = '보행(3)';
                phases[uPhaseIndex].angle = vPhase.angle;
                phases[uPhaseIndex].direction = vPhase.direction;
              } else {
                phases.push({
                  direction: vPhase.direction,
                  outputType: '보행(3)',
                  pedestrian: 0,
                  type: 'P',
                  angle: vPhase.angle,
                  ring: vPhase.ring,
                  idx: vPhase.idx
                });
              }
            }
          }
        });

        if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
          ['A', 'B'].forEach(ring => {
            const ringData = ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
            if (!ringData) return;
            for (let lsuIdx = 1; lsuIdx <= 8; lsuIdx++) {
              // 1. 시그널맵을 통째로 뒤져서, 이 링의 이 LSU 인덱스에 '보행 신호'가 존재하는지 확인.
              const hasPedLSU = sigMapDataListLocal.some(plan => {
                const planRingData = ring === 'A' ? plan.ringA : plan.ringB;
                return planRingData.some(step => {
                  return isPedActive(step[`ped${lsuIdx}`]);
                });
              });

              if (hasPedLSU) {
                // 차량 신호가 어느 현시에 켜지는지 전역 현시 번호를 계산합니다.
                const getPhaseNoForStep = (stepIndex, plan) => {
                  let phaseNo = 1;
                  for (let i = 0; i < stepIndex; i++) {
                    const eopA = plan.ringA[i]?.eop || 0;
                    const eopB = plan.ringB[i]?.eop || 0;
                    if (eopA === 1 || eopB === 1) phaseNo++;
                  }
                  return phaseNo;
                };

                let targetDirection = null;
                let targetAngle = null;
                let vehiclePhaseNo = -1;

                // 시그널맵을 통째로 뒤져 차량 신호(car)가 녹색(01)이 되는 스텝을 찾고, 해당 스텝의 전역 현시 번호를 계산합니다.
                for (const plan of sigMapDataListLocal) {
                  const planRingData = ring === 'A' ? plan.ringA : plan.ringB;
                  for (let i = 0; i < planRingData.length; i++) {
                    if (toHex(planRingData[i][`car${lsuIdx}`]) === '01') {
                      vehiclePhaseNo = getPhaseNoForStep(i, plan);
                      break;
                    }
                  }
                  if (vehiclePhaseNo !== -1) break;
                }

                if (vehiclePhaseNo === -1) {
                  vehiclePhaseNo = lsuIdx; // Fallback
                }

                // 2. 방향 특정: 이 LSU(lsuIdx)를 담당하는 차량 신호의 방향을 기반정보에서 찾는다.
                let vehPhases = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring && p.idx === vehiclePhaseNo);
                
                if (vehPhases.length === 0) {
                  // 단일 방향 링
                  const ringVehs = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring);
                  const uniqueDirs = [...new Set(ringVehs.map(p => p.direction))];
                  if (uniqueDirs.length === 1) {
                    vehPhases = [ringVehs[0]];
                  } else {
                    // 최후 수단: N+1
                    vehPhases = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring && p.idx === (vehiclePhaseNo + 1));
                  }
                }

                if (vehPhases.length > 0) {
                  targetDirection = vehPhases[0].direction;
                  targetAngle = vehPhases[0].angle;

                  // 3. '어느 현시에 켜지는가?': 보행 신호(01, 05)가 등장하는 전역 현시 번호를 추출
                  let pedPhases = new Set();
                  sigMapDataListLocal.forEach(plan => {
                    const planRingData = ring === 'A' ? plan.ringA : plan.ringB;
                    for (let i = 0; i < planRingData.length; i++) {
                      if (isPedActive(planRingData[i][`ped${lsuIdx}`])) {
                        pedPhases.add(getPhaseNoForStep(i, plan));
                      }
                    }
                  });

                  // 추출된 각각의 현시에 보행 신호를 푸시
                  pedPhases.forEach(phaseNo => {
                    // 기반정보(L02)에 이미 보행 신호가 있더라도, 시그널맵 유추를 통해 확인된 경우
                    // 항상 '시그널맵 유추'로 표출하기 위해 조건 없이 추가합니다. (이후 필터에서 기존 기반정보 P코드는 제거됨)
                    phases.push({
                      direction: targetDirection,
                      outputType: '보행(3)',
                      pedestrian: 0,
                      type: 'P',
                      angle: targetAngle,
                      ring: ring,
                      idx: phaseNo, // 정확히 계산된 현시 번호(Phase No)를 매핑!
                      inferred: true
                    });
                  });
                }
              }

              const hasLeftSignal = sigMapDataListLocal.some(plan => {
                const planRingData = ring === 'A' ? plan.ringA : plan.ringB;
                return planRingData.some(step => {
                  const hex = toHex(step[`car${lsuIdx}`]);
                  return hex === '10' || hex === '11' || hex === '20';
                });
              });
              if (hasLeftSignal) {
                const sPhases = phases.filter(p => p.type === 'S' && p.ring === ring && p.lsuIdx === lsuIdx);
                sPhases.forEach(sPhaseMatch => {
                  const hasLeftPhase = phases.some(p => p.type === 'L' && p.ring === ring && p.lsuIdx === lsuIdx && p.angle === sPhaseMatch.angle);
                  if (!hasLeftPhase) {
                    phases.push({
                      direction: sPhaseMatch.direction,
                      outputType: '좌회전(2)',
                      pedestrian: 0,
                      type: 'L',
                      angle: sPhaseMatch.angle,
                      ring: ring,
                      lsuIdx: lsuIdx,
                      inferred: true
                    });
                  }
                });
              }
            }
          });
        }
      }
    }

    const uniqueMovementsMap = new Map();
    // 시그널맵 데이터가 존재한다면, 시그널맵 유추 결과에 없는 보행 신호(SPaT 등에서 임의 생성된 것)는 제거
    if (sigMapDataListLocal && sigMapDataListLocal.length > 0) {
      const validPedAngles = new Set(phases.filter(p => p.type === 'P' && p.inferred).map(p => p.angle));
      phases = phases.filter(p => {
        if (p.type === 'P' && !p.inferred) {
          // 시그널맵을 통해 유추된 보행 신호가 있다면, 기존 기반정보(L02)나 
          // SPaT의 잘못된 보행 현시 정보를 제거하여 중복 표출 및 현시 꼬임을 방지합니다.
          return !validPedAngles.has(p.angle);
        }
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
              if (p === currentPhase) {
                stepsInPhase.push(step);
              }
              if (step.eop === 1) {
                p++;
              }
            }
            return stepsInPhase;
          };

          const activeConf = m.confs.find(conf => {
            const currentPhase = conf.ring === 'A' ? phaseA : phaseB;
            if (conf.idx !== currentPhase) return false;

            if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
              const phaseSteps = getStepsForCurrentPhase(conf.ring, currentPhase);
              if (m.type === 'P') {
                return phaseSteps.some(step => isPedActive(step[`ped${conf.idx}`]));
              } else {
                return phaseSteps.some(step => {
                  for (let i = 1; i <= 8; i++) {
                    if (isCarActive(step[`car${i}`])) return true;
                  }
                  return false;
                });
              }
            }
            return true;
          });

          const cycle = cropData.cycle || 0;

          const getPedDuration = (conf) => {
            const currentPhase = conf.ring === 'A' ? phaseA : phaseB;
            const pVal = cropData[`${conf.ring}_RING_${currentPhase}_PHASE_VAL`] || 0;
            let pedDur = pVal;
            if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
              const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
              const phaseSteps = getStepsForCurrentPhase(conf.ring, currentPhase);
              const activeSteps = phaseSteps.filter(s => isPedActive(s[`ped${conf.idx}`]));
              if (activeSteps.length > 0) {
                pedDur = activeSteps.reduce((acc, s) => acc + (s.maxTm > 0 ? s.maxTm : s.minTm), 0);
              } else {
                pedDur = Math.max(0, pedDur - 5);
              }
            } else {
              pedDur = Math.max(0, pedDur - 5);
            }
            return pedDur;
          };

          let isRed = true;

          if (cropData.cycle === 0) {
            isGreen = false;
            statText = '점멸/소등';
            statClass = 'sig-status-flash';
            remaining = '-';
            displayTime = '-';
          } else {
            if (activeConf) {
              const remainingTime = activeConf.ring === 'A' ? remainA : remainB;
              const currentPhase = activeConf.ring === 'A' ? phaseA : phaseB;
              const phaseVal = cropData[`${activeConf.ring}_RING_${currentPhase}_PHASE_VAL`] || 0;
              const elapsed = phaseVal - remainingTime;

              if (m.type === 'P') {
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
                let carActive = true;
                if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
                  const ringData = activeConf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                  const phaseSteps = getStepsForCurrentPhase(activeConf.ring, currentPhase);
                  const activeSteps = phaseSteps.filter(s => {
                    for (let i = 1; i <= 8; i++) {
                      if (isCarActive(s[`car${i}`])) return true;
                    }
                    return false;
                  });
                  if (activeSteps.length === 0) {
                    carActive = false;
                  }
                }

                if (carActive) {
                  isRed = false;
                  isGreen = true;
                  if (remainingTime <= 3) {
                    statText = '황색 점등(2)';
                    statClass = 'sig-status-yellow';
                    displayTime = '3s';
                    remaining = remainingTime + 's';
                  } else {
                    statText = '녹색 점등(3)';
                    statClass = 'sig-status-green';
                    displayTime = Math.max(0, phaseVal - 3) + 's';
                    remaining = (remainingTime - 3) + 's';
                  }
                } else {
                  isRed = true;
                }
              }
            }

            if (isRed) {
              isGreen = false;
              statText = m.type === 'P' ? '적색 점등(1)' : '적색 점등(1)';
              statClass = 'sig-status-red';

              let minRedRemain = Infinity;
              for (const conf of m.confs) {
                const ringPrefix = conf.ring === 'A' ? 'A_RING' : 'B_RING';
                const currentPhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
                const currentRemain = conf.ring === 'A' ? remainA : remainB;
                
                let targetIdx = conf.idx;
                if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
                  const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                  let foundTargetPhase = null;
                  let p = 1;
                  for (let step of ringData) {
                    const isActive = m.type === 'P'
                      ? isPedActive(step[`ped${conf.idx}`])
                      : isCarActive(step[`car${conf.idx}`]);
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

                let sumTime = 0;
                if (currentPhaseIdx === targetIdx) {
                  const phaseVal = cropData[`${ringPrefix}_${targetIdx}_PHASE_VAL`] || 0;
                  const elapsed = phaseVal - currentRemain;
                  sumTime = cycle - elapsed;
                } else {
                  sumTime = currentRemain;
                  let step = currentPhaseIdx;
                  let loopCount = 0;
                  while (step !== targetIdx && loopCount < 8) {
                    step = (step % 8) + 1;
                    if (step === targetIdx) break;
                    const split = cropData[`${ringPrefix}_${step}_PHASE_VAL`] || 0;
                    sumTime += split;
                    loopCount++;
                  }
                }
                if (sumTime < minRedRemain) minRedRemain = sumTime;
              }

              remaining = minRedRemain + 's';

              let ringTotals = { A: 0, B: 0 };
              for (const conf of m.confs) {
                if (m.type === 'P') {
                  ringTotals[conf.ring] += getPedDuration(conf);
                } else {
                  let activePhaseIdx = conf.idx;
                  if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
                    const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                    let foundTargetPhase = null;
                    let p = 1;
                    for (let step of ringData) {
                      const isActive = isCarActive(step[`car${conf.idx}`]);
                      if (isActive) { foundTargetPhase = p; break; }
                      if (step.eop === 1) p++;
                    }
                    if (foundTargetPhase !== null) activePhaseIdx = foundTargetPhase;
                  }
                  ringTotals[conf.ring] += (cropData[`${conf.ring}_RING_${activePhaseIdx}_PHASE_VAL`] || 0);
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
  }, [intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData]);
}

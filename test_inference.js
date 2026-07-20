const phases = [
  { type: 'S', angle: 253, direction: '서', ring: 'A', idx: 2 },
  { type: 'S', angle: 253, direction: '서', ring: 'A', idx: 4 },
  { type: 'S', angle: 73, direction: '동', ring: 'B', idx: 2 },
  { type: 'S', angle: 73, direction: '동', ring: 'B', idx: 4 }
];
const sigMapDataList = [
  {
    planTp: '0',
    ringA: [ { ped1: '01', ped3: '05' } ],
    ringB: [ { ped3: '01' } ]
  }
];
const sigMapData = sigMapDataList[0];

const toHex = (v) => v ? v : '00';

if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
  ['A', 'B'].forEach(ring => {
    const ringData = ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
    if (!ringData) return;
    for (let idx = 1; idx <= 8; idx++) {
      const hasPedSignal = sigMapDataList.some(plan => {
        const planRingData = ring === 'A' ? plan.ringA : plan.ringB;
        return planRingData.some(step => {
          const hex = step['ped'+idx] ? step['ped'+idx] : '00';
          return hex === '01' || hex === '05';
        });
      });
      if (hasPedSignal) {
        let vehPhases = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring && p.idx === idx);
        if (vehPhases.length === 0) {
          const ringVehs = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring);
          const uniqueDirs = [...new Set(ringVehs.map(p => p.direction))];
          if (uniqueDirs.length === 1) {
            vehPhases = [ringVehs[0]];
          } else {
            vehPhases = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring && p.idx === (idx + 1));
          }
        }
        if (vehPhases.length > 0) {
          vehPhases.forEach(vPhase => {
            const existingPed = phases.some(p => p.type === 'P' && p.ring === ring && p.idx === idx && p.angle === vPhase.angle);
            if (!existingPed) {
              phases.push({
                direction: vPhase.direction,
                outputType: '보행(3)',
                pedestrian: 0,
                type: 'P',
                angle: vPhase.angle,
                ring: ring,
                idx: idx,
                inferred: true
              });
            }
          });
        }
      }
    }
  });
}

const uniqueMovementsMap = new Map();
phases.forEach(p => {
  const key = p.angle + '_' + p.type;
  if (!uniqueMovementsMap.has(key)) {
    uniqueMovementsMap.set(key, { ...p, confs: [] });
  }
  uniqueMovementsMap.get(key).confs.push(p);
});

const updatedPhases = Array.from(uniqueMovementsMap.values());
const baseRows = [];
const conf = {};
['A', 'B'].forEach(ring => {
  for (let i = 1; i <= 8; i++) {
    const code = conf[ring + '_RING_' + i + '_PHASE_CONF_CD'];
    if (code && typeof code === 'string' && code.length >= 7) {
      baseRows.push({ remark: '기반정보' });
    }
    const inferredPhases = updatedPhases.filter(p => p.ring === ring && p.idx === i && p.inferred);
    inferredPhases.forEach(p => {
      baseRows.push({
        ringStep: ring + '링 ' + i + '현시',
        type: p.type === 'L' ? '좌회전(L)' : '보행(P)',
        remark: '시그널맵 유추'
      });
    });
  }
});
console.log(baseRows);

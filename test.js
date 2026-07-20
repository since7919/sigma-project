
const phases = [{ type: 'S', ring: 'A', idx: 2, angle: 90, direction: 'µ¿' }];
const sigMapData = { ringA: [ { ped2: '01' } ], ringB: [] };
const updatedPhases = [];
['A', 'B'].forEach(ring => {
  const ringData = ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
  if (!ringData) return;
  for (let idx = 1; idx <= 8; idx++) {
    const hasPedSignal = ringData.some(step => step['ped' + idx] === '01');
    if (hasPedSignal) {
      const vehPhases = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring && p.idx === idx);
      if (vehPhases.length > 0) {
        vehPhases.forEach(vPhase => {
          const existingPed = phases.some(p => p.type === 'P' && p.ring === ring && p.idx === idx && p.angle === vPhase.angle);
          if (!existingPed) {
            phases.push({
              direction: vPhase.direction,
              outputType: 'º¸Çà(3)',
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
const uniqueMovementsMap = new Map();
phases.forEach(p => {
  const key = p.angle + '_' + p.type;
  if (!uniqueMovementsMap.has(key)) {
    uniqueMovementsMap.set(key, { ...p, confs: [] });
  }
  uniqueMovementsMap.get(key).confs.push(p);
});
const mapped = Array.from(uniqueMovementsMap.values());
const inferredPhases = mapped.filter(p => p.ring === 'A' && p.idx === 2 && p.inferred);
console.log('Inferred:', inferredPhases);


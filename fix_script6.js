const fs = require('fs');
const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/utils/signalUtils.js';
let code = fs.readFileSync(file, 'utf8');

const replacement = `
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

    const checkActive = (phaseMapDict, degVal) => {
      const conf = phaseMapDict[degVal];
      if (!conf) return false;
      const activePhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
      if (conf.idx !== activePhaseIdx) return false;

      if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
        const activeSteps = getStepsForCurrentPhase(conf.ring, activePhaseIdx);
        if (activeSteps.length === 0) return false;
        
        let hasActiveVal = false;
        for (let s of activeSteps) {
          for (let i = 1; i <= 8; i++) {
            if (isCarActive(s[\`car\${i}\`])) hasActiveVal = true;
          }
        }
        if (!hasActiveVal) return false;
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
          const activeSteps = getStepsForCurrentPhase(conf.ring, activePhaseIdx);
          if (activeSteps.length === 0) return false;
          
          let hasPed = false;
          for (let s of activeSteps) {
            for (let i = 1; i <= 8; i++) {
              if (isPedActive(s[\`ped\${i}\`])) hasPed = true;
            }
          }
          if (!hasPed) return false;
        }
        return true;
      });
    };
`;

// Replace checkActive and checkPedActive in calculateArrowSignals
const checkActiveRegex = /const checkActive = \(phaseMapDict, degVal\) => \{[\s\S]*?\};\n\n\s*const checkPedActive = \(degVal\) => \{[\s\S]*?\};\n/g;

code = code.replace(checkActiveRegex, replacement);

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed checkActive and checkPedActive in signalUtils.js');

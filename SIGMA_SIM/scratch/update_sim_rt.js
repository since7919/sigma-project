const fs = require('fs');
let content = fs.readFileSync('js/simulation.js', 'utf8');

const target = `                if (activeStep) {
                    for (let i = 1; i <= 8; i++) {
                        if (activeStep[\`CAR\${i}\`] === "1") {
                            activeStates[i] = { st: 'G', rem: accum - currentPos };
                        }
                    }
                }`;

const replacement = `                if (activeStep) {
                    for (let i = 1; i <= 8; i++) {
                        if (activeStep[\`CAR\${i}\`] === "1") {
                            activeStates[i] = { st: 'G', rem: accum - currentPos };
                        }
                    }
                    const calcRingState = (ringPrefix) => {
                        let cumulativeTime = 0;
                        let currentPhaseIdx = 1;
                        let remainingTime = 0;
                        for (let i = 1; i <= 8; i++) {
                            const split = parseInt(activeStep[\`\${ringPrefix}_\${i}_PHASE_VAL\`]) || 0;
                            if (split === 0) continue;
                            if (currentPos < cumulativeTime + split) {
                                currentPhaseIdx = i;
                                remainingTime = (cumulativeTime + split) - currentPos;
                                break;
                            }
                            cumulativeTime += split;
                        }
                        return { currentPhaseIdx, remainingTime };
                    };
                    const ringA = calcRingState('A_RING');
                    const ringB = calcRingState('B_RING');
                    j._activePhaseA = ringA.currentPhaseIdx;
                    j._remainA = ringA.remainingTime;
                    j._activePhaseB = ringB.currentPhaseIdx;
                    j._remainB = ringB.remainingTime;
                }`;

content = content.replace(target, replacement);
fs.writeFileSync('js/simulation.js', content, 'utf8');

const fs = require('fs');
let content = fs.readFileSync('js/simulation.js', 'utf8');

// replace calc function definition and call
content = content.replace('const calc = (splits, yellows, allreds, movs, peds, pdlys, pmovs, pedGreens, pedFlashes) => {', 
'const calc = (splits, yellows, allreds, movs, peds, pdlys, pmovs, pedGreens, pedFlashes, ring) => {');

// find the exact line inside calc for active state and insert _activePhase and _remain
const targetStateStr = 'if (movId > 0) activeStates[movId] = { st, rem };';
const replaceStateStr = `if (ring === 'A') {
                            j._activePhaseA = i + 1;
                            j._remainA = Math.ceil(sv - sub);
                        } else if (ring === 'B') {
                            j._activePhaseB = i + 1;
                            j._remainB = Math.ceil(sv - sub);
                        }
                        if (movId > 0) activeStates[movId] = { st, rem };`;
                        
content = content.replace(targetStateStr, replaceStateStr);

// replace calc calls
content = content.replace(
'calc(p.splitA, p.yellowA || activeMap.yellowA, p.allredA || activeMap.allredA, activeMap.movA, activeMap.pedA, activeMap.pedDelayA, activeMap.pedMovA, activeMap.pedGreenA, activeMap.pedFlashA);',
'calc(p.splitA, p.yellowA || activeMap.yellowA, p.allredA || activeMap.allredA, activeMap.movA, activeMap.pedA, activeMap.pedDelayA, activeMap.pedMovA, activeMap.pedGreenA, activeMap.pedFlashA, "A");'
);

content = content.replace(
'calc(p.splitB, p.yellowB || activeMap.yellowB, p.allredB || activeMap.allredB, activeMap.movB, activeMap.pedB, activeMap.pedDelayB, activeMap.pedMovB, activeMap.pedGreenB, activeMap.pedFlashB);',
'calc(p.splitB, p.yellowB || activeMap.yellowB, p.allredB || activeMap.allredB, activeMap.movB, activeMap.pedB, activeMap.pedDelayB, activeMap.pedMovB, activeMap.pedGreenB, activeMap.pedFlashB, "B");'
);

// append call to updateOverlayPhaseDiagram at the end of the junction update
const hookTarget = 'Object.entries(activeStates).forEach(([mStr, s]) => {';
const hookReplace = `if (window._currentOverlayJid === j.id && typeof updateOverlayPhaseDiagram === 'function') {
                updateOverlayPhaseDiagram(j.id);
            }
            Object.entries(activeStates).forEach(([mStr, s]) => {`;
content = content.replace(hookTarget, hookReplace);

fs.writeFileSync('js/simulation.js', content, 'utf8');

const fs = require('fs');

const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/hooks/useSignalPhases.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Rename top-level const conf at line 7 to intersectionConf
code = code.replace(
  'const conf = isSeoul ? null :',
  'const intersectionConf = isSeoul ? null :'
);

// Replace usages of top-level conf in lines 47-54
code = code.replace('} else if (conf) {', '} else if (intersectionConf) {');
code = code.replace('const aPhase = parsePhaseCode(conf[`A_RING_${idx}_PHASE_CONF_CD`]);', 'const aPhase = parsePhaseCode(intersectionConf[`A_RING_${idx}_PHASE_CONF_CD`]);');
code = code.replace('const bPhase = parsePhaseCode(conf[`B_RING_${idx}_PHASE_CONF_CD`]);', 'const bPhase = parsePhaseCode(intersectionConf[`B_RING_${idx}_PHASE_CONF_CD`]);');

// 2. Rename inner loop conf variables to phaseConf
code = code.replace(/m\.confs\.find\(conf =>/g, 'm.confs.find(phaseConf =>');
code = code.replace(/for \s*\(const conf of m\.confs\)/g, 'for (const phaseConf of m.confs)');
code = code.replace(/const getPedDuration = \(conf\) =>/g, 'const getPedDuration = (phaseConf) =>');

// Replace usages of phaseConf inside getPedDuration and loops
code = code.replace(/conf\.ring/g, 'phaseConf.ring');
code = code.replace(/conf\.idx/g, 'phaseConf.idx');

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed conf TDZ bug in useSignalPhases.js!');

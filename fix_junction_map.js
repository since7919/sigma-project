const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

const badStr = 'const pMovB = sm.pedMovB || [0, 0, 0, 0, 0, 0, 0, 0];\\n    const activeMapMovs = new Set([...(sm.movA || []), ...(sm.movB || []), ...sm.pedMovA, ...sm.pedMovB].map(Number).filter(x => x > 0));';
const goodStr = `const pMovB = sm.pedMovB || [0, 0, 0, 0, 0, 0, 0, 0];
    const activeMapMovs = new Set([...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number).filter(x => x > 0));`;

c = c.replace(badStr, goodStr);

fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c, 'utf8');

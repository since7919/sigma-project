const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/utils.js', 'utf8');

const regex = /const movementMap = \{\s*1: \{ type: '↰', ang: 270 \}, 2: \{ type: '↗', ang: 45 \},\s*3: \{ type: '↰', ang: 0 \}, 4: \{ type: '↙', ang: 315 \},\s*5: \{ type: '↰', ang: 90 \}, 6: \{ type: '↙', ang: 45 \},\s*7: \{ type: '↰', ang: 180 \}, 8: \{ type: '↖', ang: 45 \},\s*9: \{ type: '↰', ang: 225 \}, 10: \{ type: '↗', ang: 0 \},\s*11: \{ type: '↰', ang: 315 \}, 12: \{ type: '↘', ang: 0 \},\s*13: \{ type: '↰', ang: 45 \}, 14: \{ type: '↙', ang: 0 \},\s*15: \{ type: '↰', ang: 135 \}, 16: \{ type: '↖', ang: 0 \}\s*\};/;

const newMap = `const movementMap = {
        1: { type: '↰', ang: 270 }, 2: { type: '↑', ang: 90 },
        3: { type: '↰', ang: 0 }, 4: { type: '↑', ang: 180 },
        5: { type: '↰', ang: 90 }, 6: { type: '↑', ang: 270 },
        7: { type: '↰', ang: 180 }, 8: { type: '↑', ang: 0 },
        9: { type: '↰', ang: 225 }, 10: { type: '↑', ang: 45 },
        11: { type: '↰', ang: 315 }, 12: { type: '↑', ang: 135 },
        13: { type: '↰', ang: 45 }, 14: { type: '↑', ang: 225 },
        15: { type: '↰', ang: 135 }, 16: { type: '↑', ang: 315 }
    };`;

c = c.replace(regex, newMap);
c = c.replace(regex.source.replace(/\\s\*/g, '\\s*'), newMap);

fs.writeFileSync('SIGMA_SIM/js/utils.js', c, 'utf8');
console.log("utils.js updated.");

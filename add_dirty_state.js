const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const target = `if (typeof renderRingTables === 'function') renderRingTables();
                    }`;

const replacement = `if (typeof renderRingTables === 'function') renderRingTables();
                    }
                    j._isDirty = true;
                    if (typeof updateDBButtonState === 'function') updateDBButtonState();`;

if (p.includes(target)) {
    p = p.replace(target, replacement);
    fs.writeFileSync('SIGMA_SIM/js/phase.js', p, 'utf8');
    console.log('Added dirty state');
} else {
    console.log('Failed to find target string');
}

const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// Fix 1: Auto-fill cycle to 0 if splits sum to 0
content = content.replace(
    /if \(sumA > 0\) \{/g,
    'if (sumA >= 0) {'
);

// Fix 2: Allow cycle to display as 0 instead of falling back to schedule cycle
content = content.replace(
    /const targetCycle = p\.cycle \|\| \(firstUsedSched \? \(firstUsedSched\.cycle \|\| 100\) : 100\);/g,
    'const targetCycle = (p.cycle !== undefined && p.cycle !== null && p.cycle !== "") ? Number(p.cycle) : (firstUsedSched ? (firstUsedSched.cycle || 100) : 100);'
);

fs.writeFileSync('SIGMA_SIM/js/phase.js', content, 'utf8');
console.log('Fixed phase.js cycle display and autofill');

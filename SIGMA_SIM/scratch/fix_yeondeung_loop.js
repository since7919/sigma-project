const fs = require('fs');

let js = fs.readFileSync('../js/stats.js', 'utf8');

// Find the exact line in renderAdvancedInsights
let lines = js.split('\n');
let replaced = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('junctions.forEach(j => {') && lines[i+1] && lines[i+1].includes('let hasValidPlan = false;')) {
        lines.splice(i + 1, 0, '        if (j.name && j.name.includes("연등")) yeondeungCount++;');
        replaced = true;
        break;
    }
}

if (replaced) {
    fs.writeFileSync('../js/stats.js', lines.join('\n'));
    console.log("Loop fixed successfully.");
} else {
    console.log("Could not find the target lines.");
}

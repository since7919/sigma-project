const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');
content = content.replace(/function updateJunctionDayUI\(\) \{\r?\n\s*renderWeeklyPlanTable\(\);/, 'function updateJunctionDayUI() {\n    if (typeof checkTodMapIntegrity === "function") checkTodMapIntegrity();\n    renderWeeklyPlanTable();');
fs.writeFileSync('SIGMA_SIM/js/phase.js', content, 'utf8');
console.log('Fixed');

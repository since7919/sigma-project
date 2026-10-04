const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

c = c.replace(
    /j\.schedules\[tgtDay\]\[tgtSlot\] = JSON\.parse\(JSON\.stringify\(j\.schedules\[srcDay\]\[srcSlot\]\)\);\s*\/\/\s*Re-render\s*renderSummaryTable\(\);/,
    `j.schedules[tgtDay][tgtSlot] = JSON.parse(JSON.stringify(j.schedules[srcDay][srcSlot]));
                    
                    // Re-render
                    if (typeof renderTodPlanInfoTable === 'function') renderTodPlanInfoTable();
                    renderSummaryTable();`
);

fs.writeFileSync('SIGMA_SIM/js/phase.js', c, 'utf8');

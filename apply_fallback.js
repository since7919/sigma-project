const fs = require('fs');

function applyFallback(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');
    
    let modified = false;

    // Pattern 1: const tod = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;
    const oldTodRegex = /const\s+tod\s*=\s*\(j\.dayPlans\s*&&\s*j\.dayPlans\[dayIdx\]\)\s*\?\s*j\.dayPlans\[dayIdx\]\[pIdx\]\s*:\s*null;/g;
    if (oldTodRegex.test(code)) {
        code = code.replace(oldTodRegex, 'const tod = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : ((j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null);');
        modified = true;
    }

    // Pattern 2: const smIdx = (j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0;
    //            const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : null;
    // We can replace the sm definition entirely!
    const oldSmRegex = /const\s+smIdx\s*=\s*\(j\.dayPlanMapIds\s*&&\s*j\.dayPlanMapIds\[dayIdx\]\)\s*\?\s*j\.dayPlanMapIds\[dayIdx\]\s*:\s*0;\s*const\s+sm\s*=\s*\(j\.signalMaps\s*&&\s*j\.signalMaps\[smIdx\]\)\s*\?\s*j\.signalMaps\[smIdx\]\s*:\s*null;/g;
    if (oldSmRegex.test(code)) {
        code = code.replace(oldSmRegex, 'const sm = typeof getEffectiveSignalMap === "function" ? getEffectiveSignalMap(j, dayIdx, pIdx) : ((j.signalMaps && j.signalMaps[((j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0)]) ? j.signalMaps[((j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0)] : null);');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, code, 'utf8');
        console.log('Applied fallback to', filePath);
    }
}

['SIGMA_SIM/js/tsd.js', 'SIGMA_SIM/tsd_popup.html', 'SIGMA_SIM/js/simulation.js', 'SIGMA_SIM/js/overlay_ui.js'].forEach(applyFallback);

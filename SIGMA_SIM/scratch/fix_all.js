const fs = require('fs');

function replaceRegex(file, regex, replacement) {
    let content = fs.readFileSync(file, 'utf8');
    if (regex.test(content)) {
        fs.writeFileSync(file, content.replace(regex, replacement));
        console.log("Success: " + file);
    } else {
        console.log("Not found: " + file);
    }
}

// 1. utils.js
const utilsRegex = /function findActiveSchedIdx\(sched, timeSec\) \{[\s\S]*?return activeIdx;\s*\}/;
const utilsRepl = `function findActiveSchedIdx(sched, timeSec) {
    if (!sched || sched.length === 0) return 0;
    let activeIdx = -1, maxSec = -1;
    let lastValidIdx = -1;
    sched.forEach((sc, idx) => {
        if (sc && sc.h !== -1) {
            lastValidIdx = idx;
            const total = sc.h * 3600 + (sc.m || 0) * 60;
            if (timeSec >= total && total > maxSec) {
                maxSec = total;
                activeIdx = idx;
            }
        }
    });
    if (activeIdx === -1) {
        activeIdx = lastValidIdx !== -1 ? lastValidIdx : 0;
    }
    return activeIdx;
}`;
replaceRegex('../js/utils.js', utilsRegex, utilsRepl);

// 2. stats.js
const statsRegex = /let activeIdx = 0;\s*for \(let i = 0; i < sched\.length; i\+\+\) \{[\s\S]*?break;\s*\}\s*\}/;
const statsRepl = `const activeIdx = typeof findActiveSchedIdx === 'function' ? findActiveSchedIdx(sched, sec) : 0;`;
replaceRegex('../js/stats.js', statsRegex, statsRepl);

// 3. rng_road_network.js
const rngRegex = /let activeIdx = 0, maxSec = -1;\s*sched\.forEach\(\(sc, idx\) => \{[\s\S]*?\}\);\s*\n/;
const rngRepl = `const activeIdx = typeof findActiveSchedIdx === 'function' ? findActiveSchedIdx(sched, targetSec) : 0;\n`;
replaceRegex('../js/rng_road_network.js', rngRegex, rngRepl);

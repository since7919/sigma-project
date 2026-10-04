const fs = require('fs');

let js = fs.readFileSync('../js/stats.js', 'utf8');

const oldLoop = `                let activeIdx = 0;
                for (let i = 0; i < sched.length; i++) {
                    if (sched[i].h < 0) continue;
                    if (sched[i].h * 3600 + (sched[i].m || 0) * 60 <= sec) {
                        activeIdx = i;
                    } else {
                        break;
                    }
                }`;

const newLoop = `                const activeIdx = typeof findActiveSchedIdx === 'function' ? findActiveSchedIdx(sched, sec) : 0;`;

js = js.replace(oldLoop, newLoop);
fs.writeFileSync('../js/stats.js', js);
console.log('Fixed inline loop in stats.js');

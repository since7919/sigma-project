const fs = require('fs');

let js = fs.readFileSync('../js/rng_road_network.js', 'utf8');

const oldLoop = `                    let activeIdx = 0, maxSec = -1;
                    sched.forEach((sc, idx) => {
                        if (sc && sc.h !== -1) {
                            const total = sc.h * 3600 + sc.m * 60;
                            if (targetSec >= total && total > maxSec) { maxSec = total; activeIdx = idx; }
                        }
                    });`;

const newLoop = `                    const activeIdx = typeof findActiveSchedIdx === 'function' ? findActiveSchedIdx(sched, targetSec) : 0;`;

js = js.replace(oldLoop, newLoop);
fs.writeFileSync('../js/rng_road_network.js', js);
console.log('Fixed inline loop in rng_road_network.js');

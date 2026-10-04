const fs = require('fs');
let p = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

// 1. Change gap to 0.5
const gapRegex = /const ringH = 12, gap = \d+(\.\d+)?;/;
p = p.replace(gapRegex, 'const ringH = 12, gap = 0.5;');

// 2. Uniform colors for rings to fix optical illusion of thickness
// Green/Blue for main movements
const mainMovRegex = /ctx\.fillStyle = isBottom \? cfg\.colors\.accent : cfg\.colors\.green;/;
p = p.replace(mainMovRegex, "ctx.fillStyle = isBottom ? '#42a5f5' : '#66bb6a'; // uniform brightness");

// Red for blocked movements
const redMovRegex = /ctx\.fillStyle = "rgba\(220, 30, 30, 0\.85\)";/;
p = p.replace(redMovRegex, "ctx.fillStyle = '#ef5350'; // uniform brightness");

// Blue for left turns
const leftMovRegex = /ctx\.fillStyle = "rgba\(60, 130, 200, 0\.70\)";/;
p = p.replace(leftMovRegex, "ctx.fillStyle = '#5c6bc0'; // uniform brightness");

// Yellow for yellow time
const yellowMovRegex = /ctx\.fillStyle = "rgba\(200, 170, 0, 0\.75\)";/g;
p = p.replace(yellowMovRegex, "ctx.fillStyle = '#ffee58'; // uniform brightness");

fs.writeFileSync('SIGMA_SIM/js/tsd.js', p, 'utf8');
console.log("Visual adjustments applied.");

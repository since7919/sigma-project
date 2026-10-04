const fs = require('fs');
let p = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

// 1. Update font and add stroke to drawPhaseArrow
const arrowOld = `this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
        this.ctx.font = 'bold 8px "JetBrains Mono", monospace';
        this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        this.ctx.fillText(m >= 100 ? 'W' : m, x, y);`;

const arrowNew = `this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 10px "JetBrains Mono", monospace';
        this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        
        // Add text stroke for better visibility
        this.ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText(m >= 100 ? 'W' : m, x, y);
        this.ctx.fillText(m >= 100 ? 'W' : m, x, y);`;

if (p.includes(arrowOld)) {
    p = p.replace(arrowOld, arrowNew);
    console.log("Updated drawPhaseArrow");
} else {
    console.log("Could not find drawPhaseArrow old block");
}

// 2. Reduce gap between rings
const gapOld = `const ringH = 12, gap = 3;`;
const gapNew = `const ringH = 12, gap = 1;`;

if (p.includes(gapOld)) {
    p = p.replace(gapOld, gapNew);
    console.log("Updated gap");
} else {
    console.log("Could not find gap variable");
}

fs.writeFileSync('SIGMA_SIM/js/tsd.js', p, 'utf8');

const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

c = c.replace(/const cycle = this\.state\.cycle, tH = cycle \* 2\.5;/, "const cycle = this.state.cycle, tH = cycle * 3.5;");

c = c.replace(/ctx\.font='bold 11px "Outfit",sans-serif';/g, "ctx.font='bold 14px \"Outfit\",sans-serif';");
c = c.replace(/ctx\.fillText\(nm,P\.left-8,y-6\);/g, "ctx.fillText(nm,P.left-12,y-8);");
c = c.replace(/ctx\.font='bold 9px "JetBrains Mono",monospace';/g, "ctx.font='bold 12px \"JetBrains Mono\",monospace';");
c = c.replace(/ctx\.fillText\(\`▸\$\{Math\.round\(this\.state\.distances\[i\]\)\}m\`,P\.left-8,y\+7\);/g, "ctx.fillText(`▸\${Math.round(this.state.distances[i])}m`,P.left-12,y+8);");
c = c.replace(/ctx\.fillText\(\`⊕\$\{Math\.round\(off\)\}s\`,P\.left-8,y\+19\);/g, "ctx.fillText(`⊕\${Math.round(off)}s`,P.left-12,y+24);");

const oldTimeAxisRegex = /\/\/ Time axis[\s\S]*?this\._updateInfo\(bUp,bDown,cycle\);/;
const newTimeAxis = `// Time axis & Grid
    for(let t=0;t<=tH;t+=20){
        const x=tToX(t);
        if(x>P.left&&x<w-P.right){
            if (t % cycle === 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(x, P.top);
            ctx.lineTo(x, h - P.bottom + 5);
            ctx.stroke();
            
            ctx.textAlign='center';
            if (t % cycle === 0) {
                ctx.fillStyle = '#4fc3f7';
                ctx.font = 'bold 14px "JetBrains Mono", monospace';
                ctx.fillText(\`\${t}s (C\${t/cycle})\`, x, h - P.bottom + 22);
            } else {
                ctx.fillStyle = '#888888';
                ctx.font = '12px "JetBrains Mono", monospace';
                ctx.fillText(\`\${t}s\`, x, h - P.bottom + 20);
            }
        }
    }

    this._updateInfo(bUp,bDown,cycle);`;

if(c.match(oldTimeAxisRegex)) {
    c = c.replace(oldTimeAxisRegex, newTimeAxis);
    fs.writeFileSync('SIGMA_SIM/tsd_popup.html', c, 'utf8');
    console.log("tsd_popup.html grid and fonts updated.");
} else {
    console.log("Could not match oldTimeAxisRegex in tsd_popup.html");
}

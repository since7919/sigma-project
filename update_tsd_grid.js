const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

// 1. timeHorizon = cycle * 3.5;
c = c.replace(/const timeHorizon = cycle \* 2\.5;/, "const timeHorizon = cycle * 3.5;");

// 2. Y-axis Labels Font Sizes & positioning
c = c.replace(/ctx\.font = 'bold 12px "Outfit", "Inter", sans-serif';/g, "ctx.font = 'bold 14px \"Outfit\", \"Inter\", sans-serif';");
c = c.replace(/ctx\.fillText\(name, cfg\.padding\.left - 8, y - 6\);/g, "ctx.fillText(name, cfg.padding.left - 12, y - 8);");

c = c.replace(/ctx\.font = 'bold 10px "JetBrains Mono", monospace';/g, "ctx.font = 'bold 12px \"JetBrains Mono\", monospace';");
c = c.replace(/ctx\.fillText\(\`▸ \$\{Math\.round\(this\.state\.distances\[i\]\)\}m\`, cfg\.padding\.left - 8, y \+ 8\);/g, "ctx.fillText(`▸ \${Math.round(this.state.distances[i])}m`, cfg.padding.left - 12, y + 8);");
c = c.replace(/ctx\.fillText\(\`⊕ \$\{Math\.round\(curOffset\)\}s\`, cfg\.padding\.left - 8, y \+ 22\);/g, "ctx.fillText(`⊕ \${Math.round(curOffset)}s`, cfg.padding.left - 12, y + 24);");

// 3. X-axis Grid Lines and Labels
const oldGridLogic = /\/\/ 시간축 눈금[\s\S]*?this\.updateInfoText\(bandUp, bandDown\);/;
const newGridLogic = `// 시간축 눈금 및 세로선 (주기별 강조)
        for (let t = 0; t <= timeHorizon; t += 20) {
            const x = tToX(t);
            if (x >= cfg.padding.left && x <= w - cfg.padding.right) {
                // 세로선
                if (t % cycle === 0) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 2;
                } else {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                    ctx.lineWidth = 1;
                }
                ctx.beginPath();
                ctx.moveTo(x, cfg.padding.top);
                ctx.lineTo(x, h - cfg.padding.bottom + 5);
                ctx.stroke();

                // 텍스트
                ctx.textAlign = 'center';
                if (t % cycle === 0) {
                    ctx.fillStyle = '#4fc3f7';
                    ctx.font = 'bold 14px "JetBrains Mono", monospace';
                    ctx.fillText(\`\${t}s (C\${t/cycle})\`, x, h - cfg.padding.bottom + 22);
                } else {
                    ctx.fillStyle = '#888888';
                    ctx.font = '12px "JetBrains Mono", monospace';
                    ctx.fillText(\`\${t}s\`, x, h - cfg.padding.bottom + 20);
                }
            }
        }

        this.updateInfoText(bandUp, bandDown);`;

if(c.match(oldGridLogic)) {
    c = c.replace(oldGridLogic, newGridLogic);
    fs.writeFileSync('SIGMA_SIM/js/tsd.js', c, 'utf8');
    console.log("tsd.js grid and fonts updated.");
} else {
    console.log("Could not match oldGridLogic in tsd.js");
}

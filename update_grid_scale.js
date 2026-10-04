const fs = require('fs');

// --- 1. Update tsd.js ---
let js = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

// Update timeHorizon
js = js.replace(/const timeHorizon = cycle \* 3\.5;/, "const timeHorizon = cycle * 4;");
js = js.replace(/const timeHorizon = cycle \* 2\.5;/, "const timeHorizon = cycle * 4;"); // Just in case

// Update Grid Logic
const oldGridRegex = /\/\/ 시간축 눈금 및 세로선 \(\주기별 강조\)\n[\s\S]*?this\.updateInfoText\(bandUp, bandDown\);/;
const newGridLogic = `// 시간축 눈금 및 세로선 (주기 비율 기반)
        const subDivisions = 4; // 1/4 주기 단위
        const step = cycle / subDivisions;
        
        for (let t = 0; t <= timeHorizon; t += step) {
            const x = tToX(t);
            if (x >= cfg.padding.left && x <= w - cfg.padding.right) {
                const isCycleEnd = (Math.round(t) % cycle === 0);
                
                // 세로선
                if (isCycleEnd) {
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

                // 텍스트 (실제 시간 표시)
                ctx.textAlign = 'center';
                if (isCycleEnd) {
                    ctx.fillStyle = '#4fc3f7';
                    ctx.font = 'bold 13px "JetBrains Mono", monospace';
                    ctx.fillText(\`\${Math.round(t)}s (C\${Math.round(t/cycle)})\`, x, h - cfg.padding.bottom + 22);
                } else {
                    ctx.fillStyle = '#888888';
                    ctx.font = '11px "JetBrains Mono", monospace';
                    ctx.fillText(\`\${Math.round(t)}s\`, x, h - cfg.padding.bottom + 20);
                }
            }
        }

        this.updateInfoText(bandUp, bandDown);`;

if(js.match(oldGridRegex)) {
    js = js.replace(oldGridRegex, newGridLogic);
    fs.writeFileSync('SIGMA_SIM/js/tsd.js', js, 'utf8');
    console.log("tsd.js grid logic updated.");
} else {
    console.log("Could not match grid logic in tsd.js");
}


// --- 2. Update tsd_popup.html ---
let html = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

// Update timeHorizon
html = html.replace(/const cycle = this\.state\.cycle, tH = cycle \* 3\.5;/, "const cycle = this.state.cycle, tH = cycle * 4;");
html = html.replace(/const cycle = this\.state\.cycle, tH = cycle \* 2\.5;/, "const cycle = this.state.cycle, tH = cycle * 4;");

// Update Grid Logic
const oldPopupGridRegex = /\/\/ Time axis & Grid\n[\s\S]*?this\._updateInfo\(bUp,bDown,cycle\);/;
const newPopupGridLogic = `// Time axis & Grid (주기 비율 기반)
    const subDivisions = 4;
    const step = cycle / subDivisions;
    for(let t=0; t<=tH; t+=step){
        const x=tToX(t);
        if(x>P.left && x<w-P.right){
            const isCycleEnd = (Math.round(t) % cycle === 0);
            if (isCycleEnd) {
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
            if (isCycleEnd) {
                ctx.fillStyle = '#4fc3f7';
                ctx.font = 'bold 13px "JetBrains Mono", monospace';
                ctx.fillText(\`\${Math.round(t)}s (C\${Math.round(t/cycle)})\`, x, h - P.bottom + 22);
            } else {
                ctx.fillStyle = '#888888';
                ctx.font = '11px "JetBrains Mono", monospace';
                ctx.fillText(\`\${Math.round(t)}s\`, x, h - P.bottom + 20);
            }
        }
    }

    this._updateInfo(bUp,bDown,cycle);`;

if(html.match(oldPopupGridRegex)) {
    html = html.replace(oldPopupGridRegex, newPopupGridLogic);
    fs.writeFileSync('SIGMA_SIM/tsd_popup.html', html, 'utf8');
    console.log("tsd_popup.html grid logic updated.");
} else {
    console.log("Could not match grid logic in tsd_popup.html");
}

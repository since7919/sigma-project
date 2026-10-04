const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

const mousemoveStr = `        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state.isDragging || this.state.isDraggingOffset) {
                if(this.tooltip) this.tooltip.style.display = 'none';
                return;
            }
            this.canvas.style.cursor = getHitJid(e) ? 'ew-resize' : 'grab';
            
            // 툴팁 처리 로직
            if (this.tooltip && this.state.hitRegions) {
                const rect = this.canvas.getBoundingClientRect();
                const mx = (e.clientX - rect.left) / (this.canvas.clientWidth / (this.canvas.width / (window.devicePixelRatio || 1)));
                const my = (e.clientY - rect.top) / (this.canvas.clientHeight / (this.canvas.height / (window.devicePixelRatio || 1)));
                
                // 역순으로 탐색 (나중에 그려진 것이 위쪽)
                let found = null;
                for (let i = this.state.hitRegions.length - 1; i >= 0; i--) {
                    const r = this.state.hitRegions[i];
                    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                        found = r;
                        break;
                    }
                }
                
                if (found && found.split > 0 && found.mov > 0) {
                    this.tooltip.style.display = 'block';
                    this.tooltip.style.left = (e.pageX + 15) + 'px';
                    this.tooltip.style.top = (e.pageY + 15) + 'px';
                    
                    let typeText = "차량";
                    if (found.mov >= 101 && found.mov <= 116) typeText = "보행";
                    
                    this.tooltip.innerHTML = \`
                        <div><strong>이동류:</strong> \${found.mov === 100 ? 'W' : found.mov} (\${typeText})</div>
                        <div><strong>총 현시:</strong> \${found.split}초</div>
                        <div><strong>녹색:</strong> <span style="color:#81c784">\${found.green}초</span></div>
                        \${found.yellow > 0 ? \`<div><strong>황색:</strong> <span style="color:#ffb74d">\${found.yellow}초</span></div>\` : ''}
                    \`;
                } else {
                    this.tooltip.style.display = 'none';
                }
            }
        });`;

const regex = /this\.canvas\.addEventListener\('mousemove', \(e\) => \{[\s\S]*?\}\);/;
c = c.replace(regex, mousemoveStr);

fs.writeFileSync('SIGMA_SIM/js/tsd.js', c, 'utf8');
console.log("Tooltip mousemove logic injected.");

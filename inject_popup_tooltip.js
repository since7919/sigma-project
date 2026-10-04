const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

// 1. Remove text and inject hitRegions.push
const textRegex = /if\(sw>14\)\{ctx\.save\(\);ctx\.fillStyle='rgba\(0,0,0,0\.65\)';ctx\.font='bold 8px "JetBrains Mono",monospace';\s*ctx\.textAlign='center';ctx\.textBaseline='middle';ctx\.fillText\(mov>=100\?'W':mov,xS\+sw\/2,yP\+rH\/2\);ctx\.restore\(\);\}/;

const textReplace = `// if(sw>14){ ... removed text ... }
          const dX = Math.max(P.left, xS);
          const dW = Math.min(P.left + cW, xE) - dX;
          if (dW > 0 && this.state.hitRegions) {
              this.state.hitRegions.push({
                  x: dX, y: yP, w: dW, h: rH,
                  mov: mov, split: st, green: Math.max(0, st - yt), yellow: yt
              });
          }`;
c = c.replace(textRegex, textReplace);

// 2. Add this.state.hitRegions = [] in render()
c = c.replace(/const w=this\.canvas\.clientWidth, h=this\.canvas\.clientHeight;/, "const w=this.canvas.clientWidth, h=this.canvas.clientHeight;\n    this.state.hitRegions = [];");

// 3. Inject global tooltip in window load
const tooltipHtml = `
<div id="tsd-tooltip" style="position:absolute; pointer-events:none; background-color:rgba(20,20,20,0.9); color:#fff; padding:8px 12px; border-radius:6px; font-size:12px; font-family:'Outfit', sans-serif; z-index:9999; display:none; box-shadow:0 4px 6px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1);"></div>
`;
c = c.replace(/<\/body>/, tooltipHtml + "\n</body>");

// 4. Update PopupTSD constructor mousemove for tooltip
const mousemoveRegex = /const hit=getHit\(e\);\s*this\.canvas\.style\.cursor=hit\?'ew-resize':'grab';/;
const mousemoveReplace = `const hit=getHit(e);
      if (this.state.isDragging || this.state.isDraggingOffset) {
          const tt = document.getElementById('tsd-tooltip');
          if (tt) tt.style.display = 'none';
          return;
      }
      this.canvas.style.cursor=hit?'ew-resize':'grab';
      
      const tt = document.getElementById('tsd-tooltip');
      if (tt && this.state.hitRegions) {
          const mx = (e.clientX - r.left) / (this.canvas.clientWidth / (this.canvas.width / (window.devicePixelRatio || 1)));
          const my = (e.clientY - r.top) / (this.canvas.clientHeight / (this.canvas.height / (window.devicePixelRatio || 1)));
          let found = null;
          for (let i = this.state.hitRegions.length - 1; i >= 0; i--) {
              const region = this.state.hitRegions[i];
              if (mx >= region.x && mx <= region.x + region.w && my >= region.y && my <= region.y + region.h) {
                  found = region;
                  break;
              }
          }
          if (found && found.split > 0 && found.mov > 0) {
              tt.style.display = 'block';
              tt.style.left = (e.pageX + 15) + 'px';
              tt.style.top = (e.pageY + 15) + 'px';
              let typeText = "차량";
              if (found.mov >= 101 && found.mov <= 116) typeText = "보행";
              tt.innerHTML = \`
                  <div><strong>이동류:</strong> \${found.mov === 100 ? 'W' : found.mov} (\${typeText})</div>
                  <div><strong>총 현시:</strong> \${found.split}초</div>
                  <div><strong>녹색:</strong> <span style="color:#81c784">\${found.green}초</span></div>
                  \${found.yellow > 0 ? \`<div><strong>황색:</strong> <span style="color:#ffb74d">\${found.yellow}초</span></div>\` : ''}
              \`;
          } else {
              tt.style.display = 'none';
          }
      }`;
c = c.replace(mousemoveRegex, mousemoveReplace);

// 5. Add mouseleave
c = c.replace(/this\.canvas\.addEventListener\('mousedown',/g, "this.canvas.addEventListener('mouseleave', () => { const tt = document.getElementById('tsd-tooltip'); if(tt) tt.style.display = 'none'; });\n    this.canvas.addEventListener('mousedown',");

fs.writeFileSync('SIGMA_SIM/tsd_popup.html', c, 'utf8');
console.log("tsd_popup.html tooltip and hitRegions injected.");

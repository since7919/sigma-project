const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

const regex = /this\.canvas\.addEventListener\('mousemove', e => \{[\s\S]*?this\.canvas\.style\.cursor = \(this\.editable && getHit\(e\)\) \? 'ew-resize' : 'grab';\s*\}\);/;

const replaceStr = `this.canvas.addEventListener('mousemove', e => {
      const hit = getHit(e);
      if (this.state.isDragging || this.state.isDraggingOffset) {
          const tt = document.getElementById('tsd-tooltip');
          if (tt) tt.style.display = 'none';
          return;
      }
      this.canvas.style.cursor = (this.editable && hit) ? 'ew-resize' : 'grab';
      
      const tt = document.getElementById('tsd-tooltip');
      if (tt && this.state.hitRegions) {
          const r = this.canvas.getBoundingClientRect();
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
      }
    });`;

if (c.match(regex)) {
    c = c.replace(regex, replaceStr);
    fs.writeFileSync('SIGMA_SIM/tsd_popup.html', c, 'utf8');
    console.log("tsd_popup mousemove updated successfully.");
} else {
    console.log("Could not match mousemove regex in tsd_popup.html.");
}

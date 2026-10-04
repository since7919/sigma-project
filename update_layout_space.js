const fs = require('fs');

// 1. tsd.js
let js = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

// Padding
js = js.replace(/padding: \{ top: 90, bottom: 60, left: 140, right: 60 \}/, "padding: { top: 50, bottom: 50, left: 140, right: 20 }");

// Left panel visual separator
const bgRegex = /ctx\.fillStyle = cfg\.colors\.bg;\s*ctx\.fillRect\(0, 0, w, h\);/;
const bgReplace = `ctx.fillStyle = cfg.colors.bg;
        ctx.fillRect(0, 0, w, h);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, cfg.padding.left, h);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cfg.padding.left, 0);
        ctx.lineTo(cfg.padding.left, h);
        ctx.stroke();`;
if(js.match(bgRegex)) js = js.replace(bgRegex, bgReplace);

fs.writeFileSync('SIGMA_SIM/js/tsd.js', js, 'utf8');
console.log('tsd.js updated');

// 2. tsd_popup.html
let html = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');
html = html.replace(/pad: \{top:70,bottom:40,left:140,right:40\}/, "pad: {top:40, bottom:40, left:140, right:20}");

const popupBgRegex = /ctx\.fillStyle='#1e2124'; ctx\.fillRect\(0,0,w,h\);/;
const popupBgReplace = `ctx.fillStyle='#1e2124'; ctx.fillRect(0,0,w,h);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, P.left, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(P.left, 0);
    ctx.lineTo(P.left, h);
    ctx.stroke();`;
if(html.match(popupBgRegex)) html = html.replace(popupBgRegex, popupBgReplace);

fs.writeFileSync('SIGMA_SIM/tsd_popup.html', html, 'utf8');
console.log('tsd_popup.html updated');

// 3. index.html
let index = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');
index = index.replace(/<div class="foldable-content p-20" style="background: #050608;">/, '<div class="foldable-content p-10" style="background: #050608;">');
fs.writeFileSync('SIGMA_SIM/index.html', index, 'utf8');
console.log('index.html updated');

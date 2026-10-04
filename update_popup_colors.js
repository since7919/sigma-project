const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

c = c.replace(/ctx\.fillStyle='#f4f4f4';/g, "ctx.fillStyle='#1e2124';");
c = c.replace(/ctx\.fillStyle='rgba\(244,244,244,0\.95\)';/g, "ctx.fillStyle='rgba(30,33,36,0.95)';");
c = c.replace(/ctx\.fillStyle='#222';/g, "ctx.fillStyle='#eeeeee';");
c = c.replace(/ctx\.fillStyle='#2e7d32';/g, "ctx.fillStyle='#81c784';");
c = c.replace(/ctx\.fillStyle=off!==0\?'#c75000':'#888';/g, "ctx.fillStyle=off!==0?'#ffb74d':'#9e9e9e';");
c = c.replace(/ctx\.fillStyle='#666';/g, "ctx.fillStyle='#aaaaaa';");
c = c.replace(/ctx\.fillStyle='rgba\(240,240,240,0\.6\)';/g, "ctx.fillStyle='rgba(40,44,48,0.65)';");
c = c.replace(/ctx\.fillStyle='rgba\(0,0,0,0\.12\)';/g, "ctx.fillStyle='rgba(255,255,255,0.15)';");

// For the green/red/yellow configs
c = c.replace(/green:'#22cc44'/g, "green:'#2e7d32'");
c = c.replace(/red:'rgba\(220,30,30,0\.85\)'/g, "red:'#c62828'");
c = c.replace(/yellow:'#ddaa00'/g, "yellow:'#f9a825'");
c = c.replace(/blue:'rgba\(60,130,200,0\.70\)'/g, "blue:'rgba(60,130,200,0.70)'");
c = c.replace(/blueFill:'rgba\(0,100,220,0\.15\)'/g, "blueFill:'rgba(41, 182, 246, 0.2)'");
c = c.replace(/bandUpS:'rgba\(0,80,200,0\.90\)'/g, "bandUpS:'rgba(41, 182, 246, 0.8)'");
c = c.replace(/bandDnS:'rgba\(0,160,220,0\.90\)'/g, "bandDnS:'rgba(102, 187, 106, 0.8)'");
c = c.replace(/trajUp:'rgba\(0,80,200,0\.85\)'/g, "trajUp:'rgba(41, 182, 246, 0.7)'");
c = c.replace(/trajDn:'rgba\(0,160,220,0\.85\)'/g, "trajDn:'rgba(102, 187, 106, 0.7)'");
c = c.replace(/wait:'#dd2222'/g, "wait:'#c62828'");
c = c.replace(/blocked:'rgba\(220,30,30,0\.85\)'/g, "blocked:'#c62828'");

fs.writeFileSync('SIGMA_SIM/tsd_popup.html', c, 'utf8');
console.log("tsd_popup.html colors updated.");

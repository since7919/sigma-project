const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

const regexColors = /colors:\s*\{[\s\S]*?wait:\s*'#dd2222'\s*\}/;
const newColors = `colors: {
                bg: '#1e2124',
                grid: 'rgba(255, 255, 255, 0.08)',
                accent: '#1976d2',
                green: '#2e7d32',
                yellow: '#f9a825',
                red: '#c62828',
                bandUp: 'rgba(41, 182, 246, 0.2)',
                bandDown: 'rgba(102, 187, 106, 0.2)',
                bandUpStroke: 'rgba(41, 182, 246, 0.8)',
                bandDownStroke: 'rgba(102, 187, 106, 0.8)',
                trajUp: 'rgba(41, 182, 246, 0.7)',
                trajDown: 'rgba(102, 187, 106, 0.7)',
                wait: '#c62828'
            }`;
c = c.replace(regexColors, newColors);

// Replace hardcoded fillStyles
c = c.replace(/ctx\.fillStyle = 'rgba\(245,245,245,0\.95\)';/g, "ctx.fillStyle = 'rgba(30,33,36,0.95)';");
c = c.replace(/ctx\.fillStyle = '#222222';/g, "ctx.fillStyle = '#eeeeee';");
c = c.replace(/ctx\.fillStyle = '#2e7d32';/g, "ctx.fillStyle = '#81c784';");
c = c.replace(/ctx\.fillStyle = curOffset !== 0 \? '#c75000' : '#888';/g, "ctx.fillStyle = curOffset !== 0 ? '#ffb74d' : '#9e9e9e';");
c = c.replace(/ctx\.fillStyle = '#555'; ctx\.font = cfg\.font\.mono;/g, "ctx.fillStyle = '#aaaaaa'; ctx.font = cfg.font.mono;");
c = c.replace(/ctx\.fillStyle = "rgba\(240,240,240,0\.65\)";/g, "ctx.fillStyle = 'rgba(40,44,48,0.65)';");
c = c.replace(/ctx\.fillStyle = 'rgba\(0,0,0,0\.15\)';/g, "ctx.fillStyle = 'rgba(255,255,255,0.15)';");
c = c.replace(/this\.ctx\.fillStyle = 'rgba\(0,0,0,0\.7\)';/g, "this.ctx.fillStyle = 'rgba(255,255,255,0.85)';");

fs.writeFileSync('SIGMA_SIM/js/tsd.js', c, 'utf8');
console.log("Colors updated for Dark Theme.");

const fs = require('fs');
let p = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

p = p.replace(/ctx\.fillStyle = cfg\.colors\.yellow;/g, "ctx.fillStyle = '#ffee58';");

fs.writeFileSync('SIGMA_SIM/js/tsd.js', p, 'utf8');
console.log("Updated cfg.colors.yellow");

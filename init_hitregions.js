const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

c = c.replace(
    /const w = container\.clientWidth, h = container\.clientHeight;/,
    `const w = container.clientWidth, h = container.clientHeight;
        this.state.hitRegions = [];`
);

fs.writeFileSync('SIGMA_SIM/js/tsd.js', c, 'utf8');
console.log("hitRegions initialized.");

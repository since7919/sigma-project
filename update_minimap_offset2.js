const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

c = c.replace(
    /const multi = 2\.5;/,
    `const multi = 7.0;`
);

fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c, 'utf8');
console.log("junction_map.js multi updated to 7.0.");

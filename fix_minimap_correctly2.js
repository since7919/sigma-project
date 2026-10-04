const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

const regex = /function createOverlayArrows[\s\S]*?renderConfigs\.forEach\(\(config, idx\) => \{\s*const pos = \[j\.lat \+ config\.dLat, j\.lng \+ config\.dLng\];/;

const match = c.match(regex);
if(match) {
    const replaced = match[0].replace('const pos = [j.lat + config.dLat, j.lng + config.dLng];', 'const multi = 4.0;\n                const pos = [j.lat + config.dLat * multi, j.lng + config.dLng * multi];');
    c = c.replace(match[0], replaced);
    fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c, 'utf8');
    console.log("junction_map.js overlay multiplier fixed.");
} else {
    console.log("Could not find regex match.");
}

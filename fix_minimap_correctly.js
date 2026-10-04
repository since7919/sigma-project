const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

const targetStr = `            renderConfigs.forEach((config, idx) => {
                const pos = [j.lat + config.dLat, j.lng + config.dLng];`;

const replaceStr = `            renderConfigs.forEach((config, idx) => {
                const multi = 4.0;
                const pos = [j.lat + config.dLat * multi, j.lng + config.dLng * multi];`;

if(c.includes(targetStr)) {
    c = c.replace(targetStr, replaceStr);
    fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c, 'utf8');
    console.log("junction_map.js overlay multiplier fixed.");
} else {
    console.log("Could not find target string.");
}

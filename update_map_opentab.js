const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/map.js', 'utf8');

const regex = /AppStateMachine\.setMode\(CONFIG\.APP_MODE\.MAP_EDIT\);/;
const newStr = `AppStateMachine.setMode(CONFIG.APP_MODE.MAP_EDIT);
        openTab(null, 'tab-info');`;

c = c.replace(regex, newStr);

fs.writeFileSync('SIGMA_SIM/js/map.js', c, 'utf8');
console.log("map.js updated with openTab.");

const fs = require('fs');

let js = fs.readFileSync('../js/stats.js', 'utf8');

const anchor = `console.log("[Stats] renderStats called");`;
const injection = `console.log("[Stats] renderStats called");
    if (Object.values(STATE.junctions).length > 0) {
        console.log("[DEBUG] First junction:", Object.values(STATE.junctions)[0].id, "Police:", Object.values(STATE.junctions)[0].police, "Office:", Object.values(STATE.junctions)[0].office);
    }`;

if (js.includes(anchor)) {
    js = js.replace(anchor, injection);
    fs.writeFileSync('../js/stats.js', js);
    console.log("Added debug log");
} else {
    console.log("Anchor not found");
}

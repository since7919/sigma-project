const fs = require('fs');

// --- Update tsd.js ---
let js = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

// Disable mouse wheel panning
js = js.replace(/this\.canvas\.addEventListener\('wheel', \(e\) => \{[\s\S]*?\}\);/, "");

fs.writeFileSync('SIGMA_SIM/js/tsd.js', js, 'utf8');
console.log('tsd.js wheel disabled');

// --- Update tsd_popup.html ---
let html = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

// Disable mouse wheel panning
html = html.replace(/this\.canvas\.addEventListener\('wheel', e => \{[\s\S]*?\}\);/, "");

// Fix viewOffsetT reset with spaces
html = html.replace(/const xF = cW \/ tH;/, "const xF = cW / tH;\n    this.state.viewOffsetT = 0;");

fs.writeFileSync('SIGMA_SIM/tsd_popup.html', html, 'utf8');
console.log('tsd_popup.html wheel disabled and offset fixed');

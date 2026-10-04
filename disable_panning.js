const fs = require('fs');

// --- Update tsd.js ---
let js = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

// Disable panning
js = js.replace(/\} else \{\s*this\.state\.isDragging = true;\s*this\.canvas\.style\.cursor = 'grabbing';\s*\}/, "} else { this.canvas.style.cursor = 'default'; }");
js = js.replace(/\} else \{\s*this\.state\.viewOffsetT -= timeDelta;\s*\}/, "}");
js = js.replace(/const timeDelta = \(deltaX \/ chartW\) \* \(this\.state\.cycle \* 2\.5\);/, "const timeDelta = (deltaX / chartW) * (this.state.cycle * 4);");

// Ensure viewOffsetT stays 0 in render just in case
js = js.replace(/const xF = chartW \/ timeHorizon;/, "const xF = chartW / timeHorizon;\n        this.state.viewOffsetT = 0;");

fs.writeFileSync('SIGMA_SIM/js/tsd.js', js, 'utf8');
console.log('tsd.js updated');

// --- Update tsd_popup.html ---
let html = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

// Disable panning
html = html.replace(/else \{ this\.state\.isDragging=true; this\.canvas\.style\.cursor='grabbing'; \}/, "else { this.canvas.style.cursor='default'; }");
html = html.replace(/else \{ this\.state\.viewOffsetT -= dt; \}/, "");
html = html.replace(/const dt=\(dx\/cW\)\*\(this\.state\.cycle\*2\.5\);/, "const dt=(dx/cW)*(this.state.cycle*4);");

// Ensure viewOffsetT stays 0 in render just in case
html = html.replace(/const xF=cW\/tH;/, "const xF=cW/tH;\n    this.state.viewOffsetT = 0;");

fs.writeFileSync('SIGMA_SIM/tsd_popup.html', html, 'utf8');
console.log('tsd_popup.html updated');

const fs = require('fs');
let js = fs.readFileSync('../js/phase_diagram_interactive.js', 'utf8');

// The previous script replaced getElementById('ipd-modal') with getElementById(this.containerId + -modal)
// which evaluated to this.containerId - modal (a variable minus a variable)
// We need to fix those.

js = js.replace(/getElementById\(this\.containerId \+ -([a-zA-Z0-9\-]+)\)/g, "getElementById(this.containerId + '-$1')");
js = js.replace(/id="this\.containerId/g, 'id="${this.containerId}'); // check if any were messed up

// Let's also check if there is an onclick handler in getModalHTML that got messed up
js = js.replace(/onclick="document\.getElementById\('ipd-modal'\)/g, 'onclick="document.getElementById(\'${this.containerId}-modal\')');

fs.writeFileSync('../js/phase_diagram_interactive.js', js);
console.log("Fixed syntax");

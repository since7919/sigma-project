const fs = require('fs');
let js = fs.readFileSync('../js/phase_diagram_interactive.js', 'utf8');

js = js.replace(/onclick="document\.getElementById\('-modal'\)\.style\.display='none'"/g, "onclick=\"document.getElementById('${this.containerId}-modal').style.display='none'\"");

fs.writeFileSync('../js/phase_diagram_interactive.js', js);
console.log("Fixed onclick");

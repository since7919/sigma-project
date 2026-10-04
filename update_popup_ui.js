const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

c = c.replace(/body \{ background:#e8e8e8;/, "body { background:#1e2124;");
c = c.replace(/\.panel \{[\s\S]*?border-right:2px solid #bbb;/, ".panel {\n  flex:1; display:flex; flex-direction:column; overflow:hidden;\n  border-right:2px solid #333;");
c = c.replace(/\.panel-left \.panel-header \{ background:#e0f0e0; color:#1a6b1a; border-bottom:2px solid #aad4aa; \}/, ".panel-left .panel-header { background:#152b19; color:#4caf50; border-bottom:2px solid #1b4d22; }");
c = c.replace(/\.panel-right \.panel-header \{ background:#e0e8f8; color:#1a3a7b; border-bottom:2px solid #aac0e8; \}/, ".panel-right .panel-header { background:#16233d; color:#42a5f5; border-bottom:2px solid #203f75; }");
c = c.replace(/\.panel-info \{ font-size:10px; font-weight:600; color:#555; \}/, ".panel-info { font-size:10px; font-weight:600; color:#aaa; }");

fs.writeFileSync('SIGMA_SIM/tsd_popup.html', c, 'utf8');
console.log("tsd_popup.html UI styles updated to dark theme.");

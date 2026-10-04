const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

const targetStr = "// if (segW > 14) this.drawPhaseArrow(xS + segW / 2, yPos + ringH / 2, curMov); // Removed text for cleaner UI";
const replacementStr = "if (segW > 14) this.drawPhaseArrow(xS + segW / 2, yPos + ringH / 2, curMov);";

if (p.includes(targetStr)) {
    p = p.replace(targetStr, replacementStr);
    fs.writeFileSync('SIGMA_SIM/js/tsd.js', p, 'utf8');
    console.log("Uncommented drawPhaseArrow in tsd.js");
} else {
    console.log("Could not find the commented code in tsd.js");
}

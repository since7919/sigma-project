const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

const badStr = "this.canvas.addEventListener(\\'mouseleave\\', () => { if(this.tooltip) this.tooltip.style.display = \\'none\\'; });\\n        this.canvas.addEventListener(\\'mousedown\\', (e) => {";
const goodStr = `this.canvas.addEventListener('mouseleave', () => { if(this.tooltip) this.tooltip.style.display = 'none'; });
        this.canvas.addEventListener('mousedown', (e) => {`;

if (c.includes(badStr)) {
    c = c.replace(badStr, goodStr);
    fs.writeFileSync('SIGMA_SIM/js/tsd.js', c, 'utf8');
    console.log("Syntax error fixed.");
} else {
    console.log("Could not find the exact bad string.");
    
    // Try regex
    const regex = /this\.canvas\.addEventListener\(\\'mouseleave\\'.*?\\n.*?mousedown\\', \(e\) => \{/;
    const match = c.match(regex);
    if (match) {
        c = c.replace(match[0], goodStr);
        fs.writeFileSync('SIGMA_SIM/js/tsd.js', c, 'utf8');
        console.log("Syntax error fixed using regex.");
    } else {
        console.log("Regex also failed.");
    }
}

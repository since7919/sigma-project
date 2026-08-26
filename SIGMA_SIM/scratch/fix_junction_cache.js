const fs = require('fs');
const path = 'SIGMA_SIM/js/junction.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

const target = `    if (elName) j.name = elName.value;`;

const replacement = `    if (elName) {
        if (j.name !== elName.value) {
            j.name = elName.value;
            if (typeof STATE !== 'undefined') STATE.sortedJunctions = null;
        }
    }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replacement successful.");
} else {
    console.log("Target not found!");
}

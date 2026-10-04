const fs = require('fs');

let dataJs = fs.readFileSync('SIGMA_SIM/js/data.js', 'utf8');

// There are two catch blocks (response.ok === false, and try-catch)
const oldOnClick = "document.getElementById('ai-report-setup').style.display='block'; document.getElementById('ai-report-content').style.display='none';";
const newOnClick = "startAIAnalysis()";

if (dataJs.includes(oldOnClick)) {
    dataJs = dataJs.split(oldOnClick).join(newOnClick);
    fs.writeFileSync('SIGMA_SIM/js/data.js', dataJs, 'utf8');
    console.log('Retry button behavior updated.');
} else {
    console.log('Could not find the old onclick behavior.');
}

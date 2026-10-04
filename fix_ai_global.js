const fs = require('fs');
let dataJs = fs.readFileSync('SIGMA_SIM/js/data.js', 'utf8');

const oldLine1 = "let baseIntersections = window.sigmaData.intersections || [];";
const newLine1 = "let baseIntersections = (window.STATE && window.STATE.junctions) ? Object.values(window.STATE.junctions) : [];";

if (dataJs.includes(oldLine1)) {
    dataJs = dataJs.replace(oldLine1, newLine1);
}

const oldLine2 = "let targetIntersections = window.filteredIntersections || baseIntersections;";
const newLine2 = "let targetIntersections = baseIntersections;"; // Default to base if filter isn't active, but wait, how is filter applied in stats.js?

if (dataJs.includes(oldLine2)) {
    // Actually, stats.js has the logic to filter. 
    // Let's just use STATE.junctions for both and let the AI know it's analyzing the whole DB if the filter isn't easily accessible.
    // Wait, the stats view renders specific numbers. Let me check how stats.js does it.
}

fs.writeFileSync('SIGMA_SIM/js/data.js', dataJs, 'utf8');
console.log('Fixed undefined global in data.js');

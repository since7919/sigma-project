const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

// 1. Extract the Summary Table
const summaryRegex = /<!-- Junction Summary Table -->[\s\S]*?<\/div>\r?\n\s*<\/div>/;
const summaryMatch = code.match(summaryRegex);
if (!summaryMatch) {
    console.error("Summary Table not found");
    process.exit(1);
}

// 2. Remove it from its original location
code = code.replace(summaryRegex, '');

// 3. Create the 3rd column in modal-top-map
const newSummaryCol = `\n<div id="overlay-summary-area" style="flex: 1; height: 100%; background: #0f172a; border-left: 1px solid #1e293b; display: flex; flex-direction: column; padding: 10px; overflow-y: auto;" class="custom-scroll">\n    ${summaryMatch[0]}\n</div>\n`;

// Insert it right after overlay-svg-area
const svgAreaEndRegex = /<text x="125" y="125" id="junction-label" class="center-label">-<\/text>\r?\n\s*<\/svg>\r?\n\s*<\/div>\r?\n<\/div>/;
code = code.replace(svgAreaEndRegex, match => match + newSummaryCol);

// 4. Change top-layout-opt to flex-col so that left and right don't share the width side-by-side
code = code.replace('<div class="top-layout-opt flex-row gap-15 mb-8"', '<div class="top-layout-opt flex-col gap-15 mb-8"');
// and remove the fixed width from viz-sidebar-opt
code = code.replace('class="viz-sidebar-opt flex-col gap-10" style="flex: 0 0 320px;"', 'class="viz-sidebar-opt flex-col gap-10" style="width: 100%;"');

fs.writeFileSync('SIGMA_SIM/index.html', code, 'utf8');
console.log("Success");

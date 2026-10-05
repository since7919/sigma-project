const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetStr = `        if (typeof renderSummaryTable === 'function') renderSummaryTable();
        if (typeof refreshDBStats === 'function') refreshDBStats();`;

const replaceStr = `        if (typeof renderSummaryTable === 'function') renderSummaryTable();
        if (typeof renderSignalMapTab === 'function') renderSignalMapTab();
        if (typeof refreshDBStats === 'function') refreshDBStats();`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Added renderSignalMapTab to UI refresh');

const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/overlay_ui.js', 'utf8');

const newFunc = `
function openStatsOverlay(jid) {
    openDetailOverlay(jid);
    switchOverlayTab('optstats');
}

window.openStatsOverlay = openStatsOverlay;
`;

if (!code.includes('function openStatsOverlay')) {
    code += '\n' + newFunc;
    fs.writeFileSync('SIGMA_SIM/js/overlay_ui.js', code, 'utf8');
    console.log('Added openStatsOverlay');
} else {
    console.log('openStatsOverlay already exists');
}

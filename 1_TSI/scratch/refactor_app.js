const fs = require('fs');
let lines = fs.readFileSync('js/app.js', 'utf8').split('\n');

const newLogic = `
let activePanels = { 1: null, 2: null };

function openDetailOverlay(item) {
    const overlay = document.getElementById('detail-overlay');
    overlay.classList.remove('hidden');

    let slot = 1;
    if (activePanels[1] && activePanels[1].item.itstId !== item.itstId) {
        if (!activePanels[2]) {
            slot = 2;
        } else {
            slot = 2; // replace slot 2
        }
    } else if (activePanels[1] && activePanels[1].item.itstId === item.itstId) {
        slot = 1;
    } else if (activePanels[2] && activePanels[2].item.itstId === item.itstId) {
        slot = 2;
    }

    if (slot === 2) {
        document.getElementById('detail-container-2').style.display = 'block';
    }

    if (activePanels[slot]) {
        activePanels[slot].destroy();
    }

    activePanels[slot] = new DetailPanel(slot, item);
}

function closeDetailOverlay() {
    document.getElementById('detail-overlay').classList.add('hidden');
    document.getElementById('detail-container-2').style.display = 'none';
    if (activePanels[1]) { activePanels[1].destroy(); activePanels[1] = null; }
    if (activePanels[2]) { activePanels[2].destroy(); activePanels[2] = null; }
}

function switchDetailTab(tabId, btnElement) {
    if(!btnElement) return;
    const container = btnElement.closest('.detail-container');
    const slot = container.id.split('-').pop();
    
    container.querySelectorAll('.detail-tab-btn').forEach(btn => btn.classList.remove('active'));
    container.querySelectorAll('.detail-tab-content').forEach(content => content.style.display = 'none');
    
    btnElement.classList.add('active');
    if (tabId === 'status') {
        container.querySelector('#tab-current-status-' + slot).style.display = 'block';
    } else {
        container.querySelector('#tab-sigmap-table-' + slot).style.display = 'block';
    }
}
`;

// In app.js, find openDetailOverlay and remove until switchDetailTab ends.
const startIdx = lines.findIndex(l => l.includes('function openDetailOverlay(item)'));
let endIdx = lines.findIndex(l => l.includes('function renderSigMapTable()'));
// find the end of renderSigMapTable
if (startIdx !== -1 && endIdx !== -1) {
    while(endIdx < lines.length && !lines[endIdx].startsWith('}')) {
        endIdx++;
    }
    lines.splice(startIdx - 4, (endIdx - startIdx) + 5, newLogic); // remove globals as well
    fs.writeFileSync('js/app.js', lines.join('\n'));
    console.log('app.js refactored successfully!');
} else {
    console.log('Could not find indices', startIdx, endIdx);
}

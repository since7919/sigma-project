const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const regexRender = /SigmaUI\.renderTable\('mov-combined-container',\s*\{\s*tableId:\s*'combined-phase-mg-table',\s*className:\s*'sigma-table',\s*head:\s*\[\{label:\s*'구분\/항목',\s*colspan:\s*2\},\s*'P1',\s*'P2',\s*'P3',\s*'P4',\s*'P5',\s*'P6',\s*'P7',\s*'P8'\],\s*rows:\s*combinedRows\s*\}\);/;

const newRender = `SigmaUI.renderTable('mov-combined-container', {
        tableId: 'combined-phase-mg-table',
        className: 'sigma-table',
        head: [{label: '구분/항목', colspan: 2}, 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        rows: combinedRows
    });

    const infoMovWrapper = document.getElementById('info-mov-table-wrapper');
    if (infoMovWrapper) {
        SigmaUI.renderTable('info-mov-table-wrapper', {
            tableId: 'info-combined-phase-mg-table',
            className: 'sigma-table',
            head: [{label: '구분/항목', colspan: 2}, 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
            rows: combinedRows
        });
    }`;

let replaced = c.replace(regexRender, newRender);

if (c !== replaced) {
    fs.writeFileSync('SIGMA_SIM/js/phase.js', replaced, 'utf8');
    console.log("phase.js updated.");
} else {
    console.log("Regex did not match in phase.js");
}

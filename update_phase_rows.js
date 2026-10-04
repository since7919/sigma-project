const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

c = c.replace(
    `const infoMovWrapper = document.getElementById('info-mov-table-wrapper');
    if (infoMovWrapper) {
        SigmaUI.renderTable('info-mov-table-wrapper', {
            tableId: 'info-combined-phase-mg-table',
            className: 'sigma-table',
            head: [{label: '구분/항목', colspan: 2}, 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
            rows: combinedRows
        });
    }`,
    `const infoMovWrapper = document.getElementById('info-mov-table-wrapper');
    if (infoMovWrapper) {
        SigmaUI.renderTable('info-mov-table-wrapper', {
            tableId: 'info-combined-phase-mg-table',
            className: 'sigma-table',
            head: [{label: '구분/항목', colspan: 2}, 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
            rows: movRows
        });
    }`
);

fs.writeFileSync('SIGMA_SIM/js/phase.js', c, 'utf8');

const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/table_logic.js', 'utf8');
c = c.replace(/todContainer\.addEventListener\('input'/g, "todContainer.addEventListener('change'");
c = c.replace(/movContainer\.addEventListener\('input'/g, "movContainer.addEventListener('change'");
c = c.replace(/summaryContainer\.addEventListener\('input'/g, "summaryContainer.addEventListener('change'");
c = c.replace(/groupTodContainer\.addEventListener\('input'/g, "groupTodContainer.addEventListener('change'");
fs.writeFileSync('SIGMA_SIM/js/table_logic.js', c, 'utf8');


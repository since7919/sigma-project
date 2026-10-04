const fs = require('fs');
let c = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

c = c.replace(
    /const filesToPatch = \['db_L01\.csv', 'db_L01_maps\.csv', 'db_L01_tod_plans\.csv', 'db_L01_stats\.csv'\];/,
    `const filesToPatch = ['db_L01_intersections.csv', 'db_L01_signal_maps.csv', 'db_L01_tod_plans.csv', 'db_L01_stats.csv'];`
);

c = c.replace(
    /if \(file === 'db_L01\.csv' && interCsvLine\) \{/,
    `if (file === 'db_L01_intersections.csv' && interCsvLine) {`
);

c = c.replace(
    /else if \(file === 'db_L01_maps\.csv' && mapCsvLines\) \{/,
    `else if (file === 'db_L01_signal_maps.csv' && mapCsvLines) {`
);

fs.writeFileSync('SIGMA_API/sigma-backend/app.js', c, 'utf8');
console.log("app.js backend cache bug fixed.");

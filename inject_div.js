const fs = require('fs');

let statsJs = fs.readFileSync('SIGMA_SIM/js/stats.js', 'utf8');

statsJs = statsJs.replace(
    "let html = '';",
    "let html = '<div class=\"ambient-aurora\"></div>';"
);

fs.writeFileSync('SIGMA_SIM/js/stats.js', statsJs, 'utf8');
console.log("Injected aurora div successfully.");

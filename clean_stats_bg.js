const fs = require('fs');

let statsJs = fs.readFileSync('SIGMA_SIM/js/stats.js', 'utf8');

statsJs = statsJs.replace(/<div class="ambient-bg".*?<\/div>/, '');

fs.writeFileSync('SIGMA_SIM/js/stats.js', statsJs, 'utf8');
console.log("Removed ambient-bg div from stats.js");

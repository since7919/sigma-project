const fs = require('fs');
let script = fs.readFileSync('scrape_all_zones.js', 'utf8');
script = script.replace('await delay(300); // 300ms delay', 'await delay(2000); // 2000ms delay to avoid HTTP 429 (Too Many Requests)');
fs.writeFileSync('scrape_all_zones.js', script, 'utf8');
console.log('patched scrape_all_zones.js delay');

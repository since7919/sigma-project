const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

js = js.replace(/<option value="LU1">↰U<\/option>/, '<option value="LU1">[↰U]</option>');
js = js.replace(/<option value="LU1,L1">↰U↰<\/option>/, '<option value="LU1,L1">[↰U] ↰</option>');
js = js.replace(/<option value="LT1">↰↑<\/option>/, '<option value="LT1">[↰↑]</option>');
js = js.replace(/<option value="LT1,L1">↰↰↑<\/option>/, '<option value="LT1,L1">[↰↑] ↰</option>');
js = js.replace(/<option value="LR1">↰↱<\/option>/, '<option value="LR1">[↰↱]</option>');

js = js.replace(/<option value="TR1">↑↱<\/option>/, '<option value="TR1">[↑↱]</option>');
js = js.replace(/<option value="TR1,R1">↑↱↱<\/option>/, '<option value="TR1,R1">[↑↱] ↱</option>');

fs.writeFileSync(path, js);
console.log('Fixed shared lane bracket representations');

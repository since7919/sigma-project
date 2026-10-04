const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// The replacement logic:
js = js.replace(
    /<option value="L2">↰ ↰<\/option>/,
    '<option value="L2">↰↰</option>'
);
js = js.replace(
    /<option value="L3">↰ ↰ ↰<\/option>/,
    '<option value="L3">↰↰↰</option>'
);
js = js.replace(
    /<option value="LU1,L1">↰U ↰<\/option>/,
    '<option value="LU1,L1">↰U↰</option>'
);
js = js.replace(
    /<option value="LT1,L1">↰ ↰↑<\/option>/,
    '<option value="LT1,L1">↰↰↑</option>'
);

// Straight
js = js.replace(
    /<option value="T2">↑ ↑<\/option>/,
    '<option value="T2">↑↑</option>'
);
js = js.replace(
    /<option value="T3">↑ ↑ ↑<\/option>/,
    '<option value="T3">↑↑↑</option>'
);
js = js.replace(
    /<option value="T4">↑ ↑ ↑ ↑<\/option>/,
    '<option value="T4">↑↑↑↑</option>'
);
js = js.replace(
    /<option value="T5">↑ ↑ ↑ ↑ ↑<\/option>/,
    '<option value="T5">↑↑↑↑↑</option>'
);

// Right
js = js.replace(
    /<option value="R2">↱ ↱<\/option>/,
    '<option value="R2">↱↱</option>'
);
js = js.replace(
    /<option value="TR1,R1">↑↱ ↱<\/option>/,
    '<option value="TR1,R1">↑↱↱</option>'
);

// Bus
js = js.replace(
    /<option value="C2">🚌 🚌<\/option>/,
    '<option value="C2">🚌🚌</option>'
);

fs.writeFileSync(path, js);
console.log('Removed spaces successfully');

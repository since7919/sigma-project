const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// The replacement logic:
js = js.replace(
    /<option value="L1">L1<\/option>/,
    '<option value="L1">↰</option>'
);
js = js.replace(
    /<option value="L2">L2<\/option>/,
    '<option value="L2">↰ ↰</option>'
);
js = js.replace(
    /<option value="L3">L3<\/option>/,
    '<option value="L3">↰ ↰ ↰</option>'
);
js = js.replace(
    /<option value="LU1">LU1<\/option>/,
    '<option value="LU1">↰U</option>'
);
js = js.replace(
    /<option value="LU1,L1">LU1,L1<\/option>/,
    '<option value="LU1,L1">↰U ↰</option>'
);
js = js.replace(
    /<option value="LT1">LT1<\/option>/,
    '<option value="LT1">↰↑</option>'
);
js = js.replace(
    /<option value="LT1,L1">LT1,L1<\/option>/,
    '<option value="LT1,L1">↰ ↰↑</option>'
);
js = js.replace(
    /<option value="LR1">LR1<\/option>/,
    '<option value="LR1">↰↱</option>'
);

// Straight
js = js.replace(
    /<option value="T1">T1<\/option>/,
    '<option value="T1">↑</option>'
);
js = js.replace(
    /<option value="T2">T2<\/option>/,
    '<option value="T2">↑ ↑</option>'
);
js = js.replace(
    /<option value="T3">T3<\/option>/,
    '<option value="T3">↑ ↑ ↑</option>'
);
js = js.replace(
    /<option value="T4">T4<\/option>/,
    '<option value="T4">↑ ↑ ↑ ↑</option>'
);
js = js.replace(
    /<option value="T5">T5<\/option>/,
    '<option value="T5">↑ ↑ ↑ ↑ ↑</option>'
);

// Right
js = js.replace(
    /<option value="R1">R1<\/option>/,
    '<option value="R1">↱</option>'
);
js = js.replace(
    /<option value="R2">R2<\/option>/,
    '<option value="R2">↱ ↱</option>'
);
js = js.replace(
    /<option value="TR1">TR1<\/option>/,
    '<option value="TR1">↑↱</option>'
);
js = js.replace(
    /<option value="TR1,R1">TR1,R1<\/option>/,
    '<option value="TR1,R1">↑↱ ↱</option>'
);
js = js.replace(
    /<option value="R_D1">우도류<\/option>/,
    '<option value="R_D1">↱(도류)</option>'
);

// Bus
js = js.replace(
    /<option value="C1">C1<\/option>/,
    '<option value="C1">🚌</option>'
);
js = js.replace(
    /<option value="C2">C2<\/option>/,
    '<option value="C2">🚌 🚌</option>'
);

fs.writeFileSync(path, js);
console.log('Replaced preset options successfully');

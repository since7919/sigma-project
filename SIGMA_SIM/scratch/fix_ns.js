const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/junction_optimizer.js', 'utf8');

code = code.replace(
    "{ id: 'N', a: -90, x: 125, y: 15, label: '북' }",
    "{ id: 'N', a: 90, x: 125, y: 235, label: '북' }"
);
code = code.replace(
    "{ id: 'S', a: 90, x: 125, y: 235, label: '남' }",
    "{ id: 'S', a: -90, x: 125, y: 15, label: '남' }"
);
code = code.replace(
    "{ id: 'NE', a: -45, x: 205, y: 45, label: '북동' }",
    "{ id: 'NE', a: 45, x: 205, y: 205, label: '북동' }"
);
code = code.replace(
    "{ id: 'SE', a: 45, x: 205, y: 205, label: '동남' }",
    "{ id: 'SE', a: -45, x: 205, y: 45, label: '동남' }"
);
code = code.replace(
    "{ id: 'SW', a: 135, x: 45, y: 205, label: '서남' }",
    "{ id: 'SW', a: 225, x: 45, y: 45, label: '서남' }"
);
code = code.replace(
    "{ id: 'NW', a: 225, x: 45, y: 45, label: '서북' }",
    "{ id: 'NW', a: 135, x: 45, y: 205, label: '서북' }"
);

fs.writeFileSync('SIGMA_SIM/js/junction_optimizer.js', code, 'utf8');
console.log("Success");

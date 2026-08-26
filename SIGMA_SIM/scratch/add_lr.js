const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/junction_optimizer.js', 'utf8');

if (!code.includes("LR: '좌_우'")) {
    code = code.replace("TR: '직_우', R: '우회전'", "TR: '직_우', LR: '좌_우', R: '우회전'");
}

if (code.includes("const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, TL: 0, TR: 0 };")) {
    code = code.replace("const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, TL: 0, TR: 0 };", "const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, LU: 0, LT: 0, TR: 0, LR: 0 };");
} else if (code.includes("const lanes = {") && !code.includes("LR: 0")) {
    code = code.replace(/const lanes = \{.*?\};/, "const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, LU: 0, LT: 0, TR: 0, LR: 0 };");
}

if (!code.includes("LR: [\"↰\", \"↱\"]")) {
    code = code.replace('TR: ["↱", "↑"]', 'TR: ["↱", "↑"], LR: ["↰", "↱"]');
}

if (!code.includes('LU1,T1,R1')) {
    const newOptions = `
        <option value="LU1,T1,R1">좌유1, 직1, 우1</option>
        <option value="LU1,T2,R1">좌유1, 직2, 우1</option>
        <option value="LT1,TR1">직좌1, 직우1</option>
        <option value="L1,LR1,R1">좌1, 좌우1, 우1</option>
    `;
    code = code.replace('<option value="T3,R1">직진3(직, 우)</option>', '<option value="T3,R1">직진3(직, 우)</option>' + newOptions);
}

fs.writeFileSync('SIGMA_SIM/js/junction_optimizer.js', code, 'utf8');
console.log('LR added');

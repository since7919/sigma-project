const fs = require('fs');

let code = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

// The code block to replace:
// const sumA = pl.splitA ? pl.splitA.reduce((a,b)=>a+b, 0) : 0;
// if (sumA === 0 && existingPlan.splitA && existingPlan.splitA.reduce((a,b)=>a+b,0) > 0) {
//     return existingPlan;
// }

const regex = /const sumA = pl\.splitA \? pl\.splitA\.reduce\(\(a,b\)=>a\+b, 0\) : 0;\s*if \(sumA === 0 && existingPlan\.splitA && existingPlan\.splitA\.reduce\(\(a,b\)=>a\+b,0\) > 0\) \{\s*return existingPlan;\s*\}/g;

if (regex.test(code)) {
    code = code.replace(regex, `const sumA = pl.splitA ? pl.splitA.reduce((a,b)=>a+b, 0) : 0;
                        if (sumA === 0) {
                            return { cycle: 0, offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
                        }`);
    fs.writeFileSync('SIGMA_SIM/js/data_parser.js', code, 'utf8');
    console.log("data_parser.js Fixed!");
} else {
    console.log("Regex not matched!");
}

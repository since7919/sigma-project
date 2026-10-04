const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

content = content.replace(
    /const splitColsL = \[\];\s*for \(let sc = spCL; sc < spCL \+ 35 && splitColsL\.length < 8; sc\+\+\) \{/g,
    `const splitColsL = [];
                                    const maxL = (noCR > spCL) ? noCR : spCL + 15;
                                    for (let sc = spCL; sc < maxL && splitColsL.length < 8; sc++) {`
);

content = content.replace(
    /const splitColsR = \[\];\s*for \(let sc = spCR; sc < spCR \+ 35 && splitColsR\.length < 8; sc\+\+\) \{/g,
    `const splitColsR = [];
                                    const maxR = spCR + 15;
                                    for (let sc = spCR; sc < maxR && splitColsR.length < 8; sc++) {`
);

fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Fixed data_parser.js scanning logic');

const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetStr = `
                        // TOD 스케줄에서 해당 슬롯(sI)이 사용하는 패턴(idx)을 찾아 매핑 (Flattening)
                        const pl = tPlans[sI];
`;

const replaceStr = `
                        // TOD 스케줄에서 해당 슬롯(sI)이 사용하는 패턴(idx)을 찾아 매핑 (Flattening)
                        const s = junction.schedules && junction.schedules[dIdx] ? junction.schedules[dIdx][sI] : null;
                        const pIdx = (s && s.idx) ? s.idx - 1 : sI;
                        const pl = tPlans[pIdx];
`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync('SIGMA_SIM/js/data_parser.js', content, 'utf8');
console.log('Fixed data_parser.js schedule flattening');

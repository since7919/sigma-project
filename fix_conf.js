const fs = require('fs');
const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src/hooks/useSignalPhases.js';
let code = fs.readFileSync(file, 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('return useMemo(() => {'));

const insertCode = `    const conf = isSeoul ? null : (() => {
      const detailData = window.L02_DETAIL_DATA || [];
      return detailData.find(d => String(d.INT_NO) === String(intersection.int_no)) || null;
    })();`;

lines.splice(start + 1, 0, insertCode);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('useSignalPhases.js fixed!');

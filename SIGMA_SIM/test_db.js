const fs = require('fs');
const xlsx = require('xlsx');
const wb = xlsx.readFile('1061 이광언내과(0124).xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const sheetData = xlsx.utils.sheet_to_json(sheet, {header: 1, blankrows: true, defval: ''});
const getVal = (r, c) => (sheetData[r-1] ? sheetData[r-1][c-1] : null);
const dayPlansFound = {};
for (let r = 1; r < sheetData.length; r++) {
    for (let c = 1; c < 60; c++) {
        const cellVal = String(getVal(r, c) || '');
        const cleanVal = cellVal.replace(/\s/g, '');
        if (cleanVal.includes('일계획(')) {
            const dMatch = cleanVal.match(/일계획\((\d+)\)/);
            if (dMatch) {
                const dNo = parseInt(dMatch[1]), slots = [];
                let timeCol = -1, cycCol = -1, idxCol = -1;
                for (let colSearch = c; colSearch < c + 12; colSearch++) {
                    const hVal = String(getVal(r + 1, colSearch) || '').toLowerCase();
                    if (hVal.includes('시간') || hVal.includes('time')) timeCol = colSearch;
                    if (hVal.includes('주기') || hVal.includes('cyc')) cycCol = colSearch;
                    if (hVal.includes('index') || hVal.includes('인덱스') || hVal.includes('idx')) idxCol = colSearch;
                }
                if (timeCol === -1) timeCol = c + 1;
                if (cycCol === -1) cycCol = c + 2;
                if (idxCol === -1) idxCol = c + 3;
                for (let sr = r + 2; sr < r + 18; sr++) {
                    let vTime = getVal(sr, timeCol), tStr = '-1';
                    if (typeof vTime === 'number') {
                        const tot = Math.round(vTime * 1440);
                        tStr = `${String(Math.floor(tot/60)).padStart(2,'0')}:${String(tot%60).padStart(2,'0')}`;
                    } else {
                        tStr = String(vTime || '-1').trim();
                    }
                    const cyc = parseInt(getVal(sr, cycCol)) || 0;
                    const tIdx = parseInt(getVal(sr, idxCol)) || 0;
                    if (cyc > 0 || (tStr !== '-1' && tStr !== '')) {
                        slots.push({ time: tStr, cycle: cyc, tpIdx: tIdx });
                    }
                }
                dayPlansFound[dNo] = slots;
            }
        }
    }
}
console.log(dayPlansFound[2]);

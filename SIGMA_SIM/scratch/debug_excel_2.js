const fs = require('fs');
const xlsx = require('xlsx');

const file = 'SIGMA_SIM/1821 남성역스타벅스(0528).xlsx';
const wb = xlsx.readFile(file);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, {header: 1});

console.log("Looking around row 244-247:");
for (let r = 240; r < 255; r++) {
    const row = data[r] || [];
    const minCols = [];
    row.forEach((cell, idx) => {
        if (cell && String(cell).includes('MIN')) minCols.push(idx);
    });
    console.log(`Row ${r}: MIN found at cols ${minCols.join(', ')}`);
}

for (let r = 0; r < data.length; r++) {
    const rowStr = (data[r] || []).join('').replace(/\s/g, '').toUpperCase();
    if (rowStr.includes('LSU1') && rowStr.includes('MIN') && rowStr.includes('EOP')) {
        console.log(`Auto-detect logic would find it at row ${r}`);
    }
}

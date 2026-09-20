const fs = require('fs');
const XLSX = require('xlsx');

const files = fs.readdirSync('SI');
const file = files.find(f => f.startsWith('1826') && f.endsWith('.xlsx'));
if (!file) { console.log('not found'); process.exit(1); }

const workbook = XLSX.readFile('SI/' + file);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

for (let r = 0; r < Math.min(sheetData.length, 100); r++) {
    const row = sheetData[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
        const cellVal = String(row[c] || '');
        if (cellVal.includes('°èÈ¹')) {
            console.log(\Row \ Col \: \\);
        }
    }
}

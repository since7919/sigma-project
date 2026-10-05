const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const filePath = path.join(__dirname, '종로구시그널맵DB(0327).xlsx');
if (!fs.existsSync(filePath)) {
    console.log('File not found in current directory. Searching...');
    const files = fs.readdirSync(__dirname);
    console.log(files.filter(f => f.endsWith('.xlsx')));
} else {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('Total rows:', data.length);
    
    // Search for "LSU 1" or "MIN"
    for (let r = 0; r < data.length; r++) {
        const row = data[r];
        if (!row) continue;
        const rowStr = row.join('|').replace(/\s/g, '').toUpperCase();
        if (rowStr.includes('LSU1') || rowStr.includes('EOP') || rowStr.includes('시그널맵')) {
            console.log(`Found at row ${r + 1}: ${row.slice(0, 15).join(' | ')}`);
        }
    }
}

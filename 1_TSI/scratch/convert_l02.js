const XLSX = require('xlsx');
const fs = require('fs');

try {
    const workbook = XLSX.readFile('L02_crossInfo.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Filter and map to the format used in app.js
    const formattedData = data.map(item => ({
        itstId: item.INT_NO?.toString(),
        nodeId: item.NODE_ID?.toString(),
        itstNm: item.INT_NM,
        la: item.Y_COORD / 10000000,
        lo: item.X_COORD / 10000000
    })).filter(item => item.itstId && item.itstNm);

    const output = `const L02_DATA = ${JSON.stringify(formattedData, null, 2)};`;
    fs.writeFileSync('js/l02_data.js', output, 'utf8');
    console.log('Successfully created js/l02_data.js with ' + formattedData.length + ' items.');
} catch (e) {
    console.error('Error:', e);
}

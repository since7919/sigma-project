const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('L02_crossInfo.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

fs.writeFileSync('L02_data.json', JSON.stringify(data, null, 2));
console.log('Successfully extracted L02_data.json');

const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, '..', '서울공공데이터');
const jsonPath = path.join(dirPath, '서울시 교차로 관련 정보.json');
const jsPath = path.join(dirPath, '서울시 교차로 관련 정보.js');

console.log('Reading JSON file...');
const rawData = fs.readFileSync(jsonPath, 'utf8');

console.log('Writing JS file...');
fs.writeFileSync(jsPath, `window.SEOUL_CROSSROAD_DATA = ${rawData.trim()};`, 'utf8');

console.log('Conversion complete! JS file saved at:', jsPath);

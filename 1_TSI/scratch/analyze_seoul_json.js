const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '서울공공데이터', '서울시 교차로 관련 정보.json');
const rawData = fs.readFileSync(filePath, 'utf8');
const parsed = JSON.parse(rawData);

const data = parsed.DATA;
const guMap = new Map();
const polMap = new Map();

data.forEach(item => {
    if (item.gu_cd) {
        guMap.set(item.gu_cd, (guMap.get(item.gu_cd) || 0) + 1);
    }
    if (item.polstn_new_cd) {
        polMap.set(item.polstn_new_cd, (polMap.get(item.polstn_new_cd) || 0) + 1);
    }
});

console.log('Unique Gu Codes (gu_cd) and Counts:');
console.log(Array.from(guMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 30));

console.log('\nUnique Police Station Codes (polstn_new_cd) and Counts:');
console.log(Array.from(polMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 30));

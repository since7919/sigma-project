const fs = require('fs');

const data = fs.readFileSync('../../1_TSI/UTIC_CrossRoadInfoService.pdf', 'utf8');
const urls = data.match(/http:\/\/tsihub.utic.go.kr[a-zA-Z0-9\/=?&_]+/g) || [];
console.log([...new Set(urls)]);

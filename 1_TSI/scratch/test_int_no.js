const http = require('http');

const url = `http://localhost:3001/proxy?url=` + encodeURIComponent(`http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&type=xml&srchCTId=L02&srchCRNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&pageNo=1&numOfRows=100`);

http.get(url, (res) => {
  let xmlString = '';
  res.on('data', (chunk) => { xmlString += chunk; });
  res.on('end', () => {
    let items = xmlString.split('<SigMapCRInfo>');
    if (items.length <= 1) items = xmlString.split('<item>');
    
    let count = 0;
    const planCounts = {};
    
    for (let i = 1; i <= Math.min(items.length - 1, 100); i++) {
        const item = items[i];
        const matchInt = item.match(/<INT_NO>([^<]+)<\/INT_NO>/);
        const intNo = matchInt ? matchInt[1] : null;
        if (intNo === '1001') {
            count++;
            const matchPlan = item.match(/<PLAN_NO>([^<]+)<\/PLAN_NO>/);
            const planNo = matchPlan ? matchPlan[1] : 'unknown';
            planCounts[planNo] = (planCounts[planNo] || 0) + 1;
        }
    }
    console.log("INT_NO 1001 count:", count);
    console.log("Plan NO counts:", planCounts);
  });
});

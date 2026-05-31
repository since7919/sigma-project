const http = require('http');

const url = `http://localhost:3001/proxy?url=` + encodeURIComponent(`http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&type=xml&srchCTId=L02&srchCRNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&pageNo=1&numOfRows=100`);

http.get(url, (res) => {
  let xmlString = '';
  res.on('data', (chunk) => { xmlString += chunk; });
  res.on('end', () => {
    let items = xmlString.split('<SigMapCRInfo>');
    if (items.length <= 1) items = xmlString.split('<item>');
    
    const uniqueCombos = new Set();
    
    for (let i = 1; i <= Math.min(items.length - 1, 100); i++) {
        const item = items[i];
        const matchRing = item.match(/<RING_NO>([^<]+)<\/RING_NO>/);
        const ringNo = matchRing ? matchRing[1] : '?';
        const matchStep = item.match(/<STEP_NO>([^<]+)<\/STEP_NO>/);
        const stepNo = matchStep ? matchStep[1] : '?';
        const matchPlan = item.match(/<INT_PLAN_NO>([^<]+)<\/INT_PLAN_NO>/); // ah, usually it's INT_PLAN_NO
        const planNo = matchPlan ? matchPlan[1] : '?';
        
        uniqueCombos.add(`Plan:${planNo} Ring:${ringNo}`);
    }
    console.log(Array.from(uniqueCombos));
  });
});

const http = require('http');

const url = `http://localhost:3001/proxy?url=` + encodeURIComponent(`http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&type=xml&srchCTId=L02&srchCRNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&pageNo=1&numOfRows=100`);

http.get(url, (res) => {
  let xmlString = '';
  res.on('data', (chunk) => { xmlString += chunk; });
  res.on('end', () => {
    let items = xmlString.split('<SigMapCRInfo>');
    if (items.length <= 1) items = xmlString.split('<item>');
    
    console.log("Total items:", items.length - 1);
    const steps1 = [];
    const steps2 = [];
    
    for (let i = 1; i <= Math.min(items.length - 1, 100); i++) {
        const item = items[i];
        const matchRing = item.match(/<RING_NO>([^<]+)<\/RING_NO>/);
        const ringNo = matchRing ? matchRing[1] : null;
        const matchStep = item.match(/<STEP_NO>([^<]+)<\/STEP_NO>/);
        const stepNo = matchStep ? matchStep[1] : null;
        const getVal = (tag) => {
            const m = item.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`));
            return m ? m[1] : '0';
        };
        const summary = `Step ${stepNo} | C1:${getVal('CAR1')} C5:${getVal('CAR5')} | MIN:${getVal('MIN_TM')}`;
        
        if (ringNo === '1') steps1.push(summary);
        else if (ringNo === '2') steps2.push(summary);
    }
    
    console.log("Ring 1 count:", steps1.length);
    console.log("Ring 1 first 3:", steps1.slice(0, 3));
    console.log("Ring 2 count:", steps2.length);
    console.log("Ring 2 first 3:", steps2.slice(0, 3));
  });
});

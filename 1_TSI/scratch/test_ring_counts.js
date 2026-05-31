const http = require('http');

const url = `http://localhost:3001/proxy?url=` + encodeURIComponent(`http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&type=xml&srchCTId=L02&srchCRNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&pageNo=1&numOfRows=100`);

http.get(url, (res) => {
  let xmlString = '';
  res.on('data', (chunk) => { xmlString += chunk; });
  res.on('end', () => {
    let items = xmlString.split('<SigMapCRInfo>');
    if (items.length <= 1) items = xmlString.split('<item>');
    
    let ringCounts = {};
    for (let i = 1; i < items.length; i++) {
        const item = items[i];
        const matchRing = item.match(/<RING_NO>([^<]+)<\/RING_NO>/);
        const ringNo = matchRing ? matchRing[1] : 'missing';
        ringCounts[ringNo] = (ringCounts[ringNo] || 0) + 1;
    }
    console.log("Ring counts:", ringCounts);
  });
});

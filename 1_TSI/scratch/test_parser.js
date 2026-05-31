const http = require('http');

const url = `http://localhost:3001/proxy?url=` + encodeURIComponent(`http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&type=xml&srchCTId=L02&srchCRNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&pageNo=1&numOfRows=100`);

http.get(url, (res) => {
  let xmlString = '';
  res.on('data', (chunk) => { xmlString += chunk; });
  res.on('end', () => {
    // Basic regex parser similar to what DOMParser does for our specific case
    let items = xmlString.split('<SigMapCRInfo>');
    if (items.length <= 1) items = xmlString.split('<item>');
    
    console.log("Items found:", items.length - 1);
    const steps = [];
    if (items.length > 1) {
        // Extract INT_NO from first item
        const firstIntNoMatch = items[1].match(/<INT_NO>([^<]+)<\/INT_NO>/);
        const firstIntNo = firstIntNoMatch ? firstIntNoMatch[1] : null;
        console.log("First INT_NO:", firstIntNo);

        for (let i = 1; i < items.length; i++) {
            const item = items[i];
            const intNoMatch = item.match(/<INT_NO>([^<]+)<\/INT_NO>/);
            const intNo = intNoMatch ? intNoMatch[1] : null;

            if (intNo === firstIntNo) {
                const getVal = (tag) => {
                    const m = item.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`));
                    return m ? parseInt(m[1]) : 0;
                };
                steps.push({
                    stepNo: getVal('STEP_NO'),
                    car1: getVal('CAR1'), ped1: getVal('PED1'),
                    minTm: getVal('MIN_TM'), maxTm: getVal('MAX_TM'), eop: getVal('EOP')
                });
            }
        }
    }
    console.log("Steps parsed:", steps.length);
    console.log("Sample Step 1:", steps[0]);
  });
});

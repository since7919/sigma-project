const http = require('http');

const url = `http://localhost:3001/proxy?url=` + encodeURIComponent(`http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&type=xml&srchCTId=L02&srchCRNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&pageNo=1&numOfRows=100`);

http.get(url, (res) => {
  let xmlString = '';
  res.on('data', (chunk) => { xmlString += chunk; });
  res.on('end', () => {
    // Basic DOM Parser mock
    const { DOMParser } = require('xmldom');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    let items = xmlDoc.getElementsByTagName("SigMapCRInfo");
    if (items.length === 0) items = xmlDoc.getElementsByTagName("item");
    
    console.log("SigMap XML parsing, items found:", items.length);
    
    const stepsA = [];
    const stepsB = [];
    if (items.length > 0) {
        const firstIntNo = items[0].getElementsByTagName("INT_NO")[0]?.textContent;
        console.log("firstIntNo:", firstIntNo);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
            if (intNo === firstIntNo) {
                const ringNo = item.getElementsByTagName("RING_NO")[0]?.textContent || '0';
                const step = {
                    stepNo: parseInt(item.getElementsByTagName("STEP_NO")[0]?.textContent || 0),
                    minTm: parseInt(item.getElementsByTagName("MIN_TM")[0]?.textContent || 0),
                    maxTm: parseInt(item.getElementsByTagName("MAX_TM")[0]?.textContent || 0),
                    eop: parseInt(item.getElementsByTagName("EOP")[0]?.textContent || 0)
                };
                for (let j=1; j<=8; j++) {
                    step[`car${j}`] = parseInt(item.getElementsByTagName(`CAR${j}`)[0]?.textContent || 0);
                    step[`ped${j}`] = parseInt(item.getElementsByTagName(`PED${j}`)[0]?.textContent || 0);
                }
                
                if (ringNo === '1' || ringNo === '2' || ringNo === 'B') stepsB.push(step);
                else stepsA.push(step);
            }
        }
    }
    
    console.log("stepsA:", stepsA.length, "stepsB:", stepsB.length);
  });
});

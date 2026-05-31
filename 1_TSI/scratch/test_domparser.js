const http = require('http');
const DOMParser = require('xmldom').DOMParser; // We will mock DOMParser

const url = `http://localhost:3001/proxy?url=` + encodeURIComponent(`http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&type=xml&srchCTId=L02&srchCRNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&pageNo=1&numOfRows=100`);

http.get(url, (res) => {
  let xmlString = '';
  res.on('data', (chunk) => { xmlString += chunk; });
  res.on('end', () => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    let items = xmlDoc.getElementsByTagName("SigMapCRInfo");
    if (items.length === 0) items = xmlDoc.getElementsByTagName("item");
    
    console.log("Items found:", items.length);
    const steps = [];
    if (items.length > 0) {
        const firstIntNo = items[0].getElementsByTagName("INT_NO")[0]?.textContent;
        console.log("First INT_NO:", firstIntNo);
        
        // Mock NodeList iteration
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const intNoNode = item.getElementsByTagName("INT_NO")[0];
            const intNo = intNoNode ? intNoNode.textContent : null;
            if (intNo === firstIntNo) {
                steps.push(intNo);
            }
        }
    }
    console.log("Steps parsed:", steps.length);
  });
});

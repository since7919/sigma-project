const https = require('https');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const endpoints = [
  'getPlanSGMAPInfo', 'getPlanSGNMInfo', 'getPlanSGNLInfo', 'getPlanSMAPInfo', 'getPlanSGMpInfo'
];

endpoints.forEach(ep => {
  const url = `https://www.utic.go.kr/api/tsi/api/PlanCrossRoadInfoService/${ep}?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&type=xml&srchCTId=L02&srchCRNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&pageNo=1&numOfRows=10`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (!data.includes('SERVICE_ERROR') && !data.includes('404')) {
         console.log(`Success with ${ep}:`, data.substring(0, 300));
      } else {
         console.log(`Failed ${ep}`);
      }
    });
  });
});

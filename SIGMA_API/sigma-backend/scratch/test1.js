const https = require('https');
const url = 'https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingFusionInformation/1.0?apiKey=a6a8e58e-7215-4025-b453-2d33cdd09eb2&type=json&itstId=21722&numOfRows=1';
const fetch = () => new Promise(r => https.get(url, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => r(JSON.parse(data)));
}));

(async () => {
  for(let i=0; i<3; i++){
    const res = await fetch();
    const d = res[0];
    console.log(`Run ${i}: msgCreatDs=${d.msgCreatDs}, Time: neStsgRmdrCs=${d.neStsgRmdrCs}, swStsgRmdrCs=${d.swStsgRmdrCs}, nwPdsgRmdrCs=${d.nwPdsgRmdrCs}`);
    await new Promise(r => setTimeout(r, 4000));
  }
})();

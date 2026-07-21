const axios = require('axios');
async function fetchSigMap() {
  const url = 'http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanSigMapInfo?type=xml&srchCTId=L02&srchCRNm=' + encodeURIComponent('우현로입구') + '&pageNo=1&numOfRows=200';
  try {
    const res = await axios.get(url);
    const xml2js = require('xml2js');
    xml2js.parseString(res.data, (err, result) => {
      const items = result.response.body[0].items[0].PlanSigMapInfo;
      let rings = { A: [], B: [] };
      items.forEach(item => {
        const ring = item.RNG_TYPE_CD[0];
        const step = parseInt(item.STEP_NO[0]);
        const eop = parseInt(item.EOP_YN[0] || '0');
        const ped2 = item.PDSG_STAT_2[0];
        if (ring === 'A') rings.A.push({step, eop});
        if (ring === 'B') rings.B.push({step, eop, ped2});
      });
      console.log('B Ring Steps:');
      rings.B.sort((a,b)=>a.step-b.step).forEach(s => {
        console.log('Step ' + s.step + ': ped2=' + s.ped2 + ', eop=' + s.eop);
      });
      console.log('A Ring Steps:');
      rings.A.sort((a,b)=>a.step-b.step).forEach(s => {
        console.log('Step ' + s.step + ': eop=' + s.eop);
      });
    });
  } catch(e) {
    console.error(e.message);
  }
}
fetchSigMap();

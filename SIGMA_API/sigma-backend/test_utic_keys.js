const axios = require('axios');
require('dotenv').config();

async function run() {
  const url = `http://tsihub.utic.go.kr/tsi/api/CrossRoadInfoService/getCRInfo?serviceKey=${process.env.UTIC_API_KEY}&type=json&srchCTId=L03&pageNo=1&numOfRows=1`;
  const res = await axios.get(url);
  console.log("Full data:", JSON.stringify(res.data, null, 2));
}

run().catch(console.error);

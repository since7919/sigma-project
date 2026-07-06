const axios = require('axios');
const xlsx = require('xlsx');
require('dotenv').config();

async function run() {
  const url = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/download/planCrossInfo?serviceKey=${process.env.UTIC_API_KEY}&srchCTId=L02`;
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    console.log("Downloaded bytes:", res.data.length);
    const workbook = xlsx.read(res.data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log("Parsed rows:", data.length);
    console.log("Keys:", Object.keys(data[0]));
  } catch(e) {
    console.error(e);
  }
}

run();

const axios = require('axios');
require('dotenv').config();
const url = `http://tsihub.utic.go.kr/tsi/api/CrossRoadInfoService/getCrossRoadInfo?serviceKey=${process.env.UTIC_API_KEY}&type=json&srchCTId=L02&pageNo=1&numOfRows=9999`;
axios.get(url).then(r => console.log(typeof r.data === 'string' ? r.data.substring(0, 500) : JSON.stringify(r.data).substring(0, 500))).catch(e => console.error(e.message));

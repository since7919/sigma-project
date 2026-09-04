const axios = require('axios');
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';

const paths = [
  'v1/getCrsrdMapInfo',
  'v1/getTlDrctInfo',
  'getCrsrdMapInfo',
  'getTlDrctInfo',
  'crsrdMap',
  'tlDrct',
  'api/crsrd_map_info',
  'api/tl_drct_info'
];

async function test(pathStr) {
    const url = `https://apis.data.go.kr/B551962/rti/${pathStr}?serviceKey=${serviceKey}&type=json`;
    try {
        const res = await axios.get(url, { timeout: 3000 });
        console.log(`[SUCCESS] ${pathStr}: HTTP ${res.status}`);
        console.log(JSON.stringify(res.data).substring(0, 200));
    } catch (e) {
        if (e.response) {
            console.log(`[ERROR] ${pathStr}: HTTP ${e.response.status}`);
        } else {
            console.log(`[ERROR] ${pathStr}: ${e.message}`);
        }
    }
}

async function run() {
    for (const p of paths) {
        await test(p);
    }
}
run();

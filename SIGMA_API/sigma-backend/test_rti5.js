const axios = require('axios');
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';

async function test() {
    const url = `https://apis.data.go.kr/B551962/rti/crsrd_map_info?serviceKey=${serviceKey}&pageNo=1&numOfRows=10&type=json&stdgCd=1100000000`;
    try {
        const res = await axios.get(url, { timeout: 10000 });
        console.log(JSON.stringify(res.data).substring(0, 500));
    } catch (e) {
        if (e.response) {
            console.error(`HTTP ${e.response.status}`);
            console.error(JSON.stringify(e.response.data));
        } else {
            console.error(`Error:`, e.message);
        }
    }
}
test();

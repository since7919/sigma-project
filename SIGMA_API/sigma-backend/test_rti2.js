const axios = require('axios');
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';

async function test(endpoint) {
    const url = `https://apis.data.go.kr/B551962/rti/${endpoint}?serviceKey=${serviceKey}&pageNo=1&numOfRows=10&type=json`;
    try {
        const res = await axios.get(url, { timeout: 10000 });
        console.log(JSON.stringify(res.data).substring(0, 500));
    } catch (e) {
        if (e.response) {
            console.error(`Endpoint ${endpoint} error HTTP ${e.response.status}`);
            console.error(JSON.stringify(e.response.data));
        } else {
            console.error(`Endpoint ${endpoint} error:`, e.message);
        }
    }
}
test('crsrd_map_info');

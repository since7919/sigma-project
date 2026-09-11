const axios = require('axios');
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';

async function test(protocol) {
    const url = `${protocol}://apis.data.go.kr/B551962/rti/crsrd_map_info?serviceKey=${serviceKey}&pageNo=1&numOfRows=10&type=json&stdgCd=4143000000`;
    try {
        const res = await axios.get(url, { timeout: 10000 });
        console.log(`[${protocol}] success:`, JSON.stringify(res.data).substring(0, 300));
    } catch (e) {
        if (e.response) {
            console.error(`[${protocol}] HTTP ${e.response.status}`, JSON.stringify(e.response.data));
        } else {
            console.error(`[${protocol}] error:`, e.message);
        }
    }
}
async function run() {
    await test('http');
    await test('https');
}
run();

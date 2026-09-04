const axios = require('axios');
require('dotenv').config();
const key = process.env.UTIC_API_KEY || '5a4d6f4b-70c3-4a1b-a590-bdf14d014902';

async function test(regionCode) {
    const url = `http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=${key}&type=json&srchCTId=${regionCode}`;
    try {
        const res = await axios.get(url, { timeout: 10000 });
        console.log(`Region ${regionCode}: HTTP ${res.status}`);
        console.log(typeof res.data === 'string' ? res.data.substring(0, 500) : JSON.stringify(res.data).substring(0, 500));
    } catch (e) {
        if (e.response) {
            console.error(`Region ${regionCode}: HTTP ${e.response.status}`);
            console.error(e.response.data.toString().substring(0, 500));
        } else {
            console.error(`Region ${regionCode} error:`, e.message);
        }
    }
}

test('L16');
test('110'); // maybe Uiwang is another code?

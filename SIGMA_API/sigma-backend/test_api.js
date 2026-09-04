const axios = require('axios');
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';
async function test() {
    const sggCd = '11680';
    const url = `https://apis.data.go.kr/1320000/safetyzonedtlinfo/getdtllist?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&type=json&sggCd=${sggCd}`;
    try {
        const res = await axios.get(url);
        console.log('Result for', sggCd, ':', JSON.stringify(res.data).substring(0, 500));
    } catch (e) { console.error(e.message); }
}
test();

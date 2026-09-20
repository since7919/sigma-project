const axios = require('axios');
async function test() {
    const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';
    const apiUrl = `https://apis.data.go.kr/1320000/safetyzonedtlinfo/getdtllist?serviceKey=${serviceKey}&pageNo=1&numOfRows=10&type=json&sggCd=26320`;
    try {
        const res = await axios.get(apiUrl, { timeout: 10000 });
        console.log('Success! Status:', res.status);
    } catch (e) {
        console.log('Failed:', e.response ? e.response.status : e.message);
    }
}
test();

const axios = require('axios');
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';
async function test() {
    const apiUrl = 'https://apis.data.go.kr/1320000/safetyzonedtlinfo/getdtllist?serviceKey=' + serviceKey + '&pageNo=1&numOfRows=10&type=json';
    try {
        const response = await axios.get(apiUrl);
        if (response.data && response.data.response && response.data.response.body) {
            console.log('Total Count:', response.data.response.body.totalCount);
        } else {
            console.log('Data:', response.data);
        }
    } catch (e) {
        console.error(e.message);
    }
}
test();

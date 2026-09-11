const axios = require('axios');
async function checkTotalCount() {
    const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';
    const url = `http://apis.data.go.kr/1320000/safetyzonedtlinfo/getdtllist?serviceKey=${serviceKey}&pageNo=1&numOfRows=1&type=json`;
    try {
        const res = await axios.get(url, { timeout: 10000 });
        console.log("Response:", JSON.stringify(res.data).substring(0, 300));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
checkTotalCount();

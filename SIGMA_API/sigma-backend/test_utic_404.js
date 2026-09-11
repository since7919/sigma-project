const axios = require('axios');
async function test() {
    const url = 'http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?regionCode=110&itstNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&type=json&serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI';
    try {
        const res = await axios.get(url, { timeout: 15000 });
        console.log("Success HTTP", res.status);
    } catch (e) {
        if (e.response) {
            console.error(`HTTP ${e.response.status}`);
        } else {
            console.error("Error:", e.message);
        }
    }
}
test();

const axios = require('axios');
async function test() {
    const renderUrl = 'https://sigma-project-245n.onrender.com/api/proxy/utic?regionCode=110&itstNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC';
    try {
        const res = await axios.get(renderUrl, { timeout: 15000 });
        console.log("Success:", JSON.stringify(res.data).substring(0, 300));
    } catch (e) {
        if (e.response) {
            console.error(`HTTP ${e.response.status}:`, JSON.stringify(e.response.data));
        } else {
            console.error("Error:", e.message);
        }
    }
}
test();

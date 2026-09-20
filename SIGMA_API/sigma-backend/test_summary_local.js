const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('http://127.0.0.1:3000/api/safetyzone/summary');
        console.log(res.data);
    } catch (e) {
        console.error(e.message);
    }
}
test();

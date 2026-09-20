const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('https://sigma-project-245n.onrender.com/api/safetyzone/summary');
        console.log(res.data);
    } catch (e) {
        console.error(e.message);
    }
}
test();

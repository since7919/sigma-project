const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('https://sigma-project-245n.onrender.com/api/safetyzone?regionCode=L01');
        const items = res.data.items;
        const sggCds = [...new Set(items.map(i => i.sggCd.substring(0,2)))];
        console.log(`L01 (Seoul) response returned ${items.length} items.`);
        console.log(`SGG Prefixes found in response: ${sggCds.join(', ')}`);
    } catch (e) {
        console.error(e.message);
    }
}
test();

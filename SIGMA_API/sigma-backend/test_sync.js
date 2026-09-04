const axios = require('axios');
async function testSync() {
    try {
        const res = await axios.get('http://localhost:3000/api/intersections/sync?regionCode=L02');
        console.log(`Sync success: ${res.data.count} items inserted.`);
    } catch(e) {
        console.error('Sync failed:', e.response ? e.response.data : e.message);
    }
}
testSync();

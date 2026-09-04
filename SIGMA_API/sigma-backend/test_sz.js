const axios = require('axios');

async function check() {
    try {
        const res = await axios.get('http://localhost:3000/api/safetyzone?regionCode=L01');
        const item = res.data.items[0];
        console.log(item.geojson);
    } catch(e) { console.error(e.message); }
}
check();

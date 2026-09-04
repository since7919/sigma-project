const axios = require('axios');
async function check() {
    try {
        const res = await axios.get('http://localhost:3000/api/intersections');
        console.log(`Total: ${res.data.length}`);
        let l02Count = res.data.filter(i => i.region_cd === 'L02').length;
        console.log(`L02 count: ${l02Count}`);
    } catch(e) { console.error(e.message); }
}
check();

const axios = require('axios');
async function check() {
    try {
        const res = await axios.get('http://localhost:3000/api/intersections');
        console.log(res.data[0]);
    } catch(e) { console.error(e.message); }
}
check();

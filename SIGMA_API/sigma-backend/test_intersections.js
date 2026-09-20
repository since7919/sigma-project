const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// We don't have the supabase key directly here, but we can hit the local/live API if it returns intersections!
const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('https://sigma-project-245n.onrender.com/api/intersections');
        const items = res.data;
        const sanggye = items.find(i => i.int_nm && i.int_nm.includes('상계주공15단지'));
        if (sanggye) {
            console.log(`Found 상계주공15단지: ID=${sanggye.id}, Lng=${sanggye.x_coord}, Lat=${sanggye.y_coord}, Region=${sanggye.region_cd}`);
        } else {
            console.log('상계주공15단지 not found in /api/intersections');
        }
    } catch (e) {
        console.error(e.message);
    }
}
test();

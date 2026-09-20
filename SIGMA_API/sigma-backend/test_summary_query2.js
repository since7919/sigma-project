const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
    try {
        const { data, error } = await supabase.from('safety_zones').select('ptznmngno').like('sggcd', '11%').limit(1);
        console.log('Result:', data, error);
    } catch (e) {
        console.error(e.message);
    }
}
test();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.log('No supabase credentials found in .env');
    process.exit(0);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    try {
        const { data, error } = await supabase.from('safety_zones').select('id, sggcd').like('sggcd', '11%').limit(1);
        console.log('Result:', data, error);
    } catch (e) {
        console.error(e.message);
    }
}
test();

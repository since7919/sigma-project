const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
    try {
        const { data, error } = await supabase.from('safety_zones').select('*').like('sggcd', '27%').limit(2);
        if (error) throw error;
        
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}
test();

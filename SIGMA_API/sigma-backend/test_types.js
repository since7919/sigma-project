const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
    try {
        const { data, error } = await supabase.from('safety_zones').select('type').limit(100);
        if (error) throw error;
        
        const types = new Set();
        data.forEach(d => {
            if (d.type) types.add(d.type);
        });
        console.log('Distinct types:', Array.from(types));
    } catch (e) {
        console.error(e.message);
    }
}
test();

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
    try {
        // Fetch a bunch of records to see unique prefixes
        const { data, error } = await supabase.from('safety_zones').select('sggcd');
        if (error) throw error;
        
        const prefixes = new Set();
        data.forEach(d => {
            if (d.sggcd) prefixes.add(d.sggcd.substring(0, 2)); // e.g. 11, 28, 41
        });
        
        console.log('Distinct 2-digit prefixes found in DB:', Array.from(prefixes));
        
        const prefixes4 = new Set();
        data.forEach(d => {
            if (d.sggcd && d.sggcd.startsWith('41')) prefixes4.add(d.sggcd.substring(0, 4)); 
        });
        console.log('Distinct 4-digit prefixes starting with 41:', Array.from(prefixes4));
        
    } catch (e) {
        console.error(e.message);
    }
}
test();

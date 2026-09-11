const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkSize() {
    // Supabase RPC for size, or we can just count rows
    const { count, error } = await supabase.from('safety_zones').select('*', { count: 'exact', head: true });
    console.log(`Row Count: ${count}`);
    
    // We can't easily run pg_size_pretty without a custom RPC, so we estimate based on bytes of one row.
    const { data } = await supabase.from('safety_zones').select('*').limit(10);
    if (data && data.length > 0) {
        let totalBytes = 0;
        data.forEach(row => totalBytes += JSON.stringify(row).length);
        const avgBytes = totalBytes / data.length;
        console.log(`Average row size (approx): ${Math.round(avgBytes)} bytes`);
        console.log(`Total estimated size for 20000 rows: ${Math.round(avgBytes * 20000 / 1024 / 1024)} MB`);
    }
}
checkSize();

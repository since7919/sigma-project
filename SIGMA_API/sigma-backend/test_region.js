const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data } = await supabase.from('intersections').select('region_cd').limit(10);
    console.log(data);
}
check();

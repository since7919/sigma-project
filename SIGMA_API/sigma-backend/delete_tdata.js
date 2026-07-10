require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { data, error } = await supabase.from('utic_intersections').delete().eq('origin_type', '¼­¿ïtdata');
  if (error) {
    console.error('Error deleting:', error);
  } else {
    console.log('Deleted successfully. Result:', data);
  }
}
run();

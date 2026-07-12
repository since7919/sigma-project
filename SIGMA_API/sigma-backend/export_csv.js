require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function exportData() {
  console.log('Fetching utic_intersections...');
  const { data: uticData, error: uticError } = await supabase.from('utic_intersections').select('*');
  if (uticError) {
    console.error('Error fetching utic_intersections:', uticError);
  } else {
    if (uticData.length > 0) {
      const keys = Object.keys(uticData[0]);
      const csv = [
        keys.join(','),
        ...uticData.map(row => keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      fs.writeFileSync('utic_intersections.csv', csv);
      console.log(`Exported ${uticData.length} rows to utic_intersections.csv`);
    } else {
        console.log('No data in utic_intersections');
    }
  }

  console.log('Fetching junctions...');
  const { data: junctionsData, error: junctionsError } = await supabase.from('junctions').select('*');
  if (junctionsError) {
    console.error('Error fetching junctions:', junctionsError);
  } else {
    if (junctionsData.length > 0) {
      const keys = Object.keys(junctionsData[0]);
      const csv = [
        keys.join(','),
        ...junctionsData.map(row => keys.map(k => {
            let val = row[k];
            if (typeof val === 'object') val = JSON.stringify(val);
            return `"${String(val || '').replace(/"/g, '""')}"`;
        }).join(','))
      ].join('\n');
      fs.writeFileSync('junctions.csv', csv);
      console.log(`Exported ${junctionsData.length} rows to junctions.csv`);
    } else {
        console.log('No data in junctions');
    }
  }
}

exportData();

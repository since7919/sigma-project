const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

// Use Regex to match the block loosely
const pattern = /app\.get\('\/api\/safetyzone', async \(req, res\) => \{\s*try \{\s*let allData = \[\];\s*let from = 0;\s*const step = 1000;\s*\/\/ Supabase 1,000건 한도 우회를 위한 페이징 로직\s*while \(true\) \{\s*const \{ data, error \} = await supabase\s*\.from\('safety_zones'\)\s*\.select\('\*'\)\s*\.range\(from, from \+ step - 1\);/m;

const newCode = `app.get('/api/safetyzone', async (req, res) => {
  try {
    const { regionCode } = req.query;
    let sggPrefix = '';
    if (regionCode === 'L01') sggPrefix = '11%';
    else if (regionCode === 'L02') sggPrefix = '28%';
    
    let allData = [];
    let from = 0;
    const step = 1000;
    
    // Supabase 1,000건 한도 우회를 위한 페이징 로직
    while (true) {
      let query = supabase.from('safety_zones').select('*');
      if (sggPrefix) {
        query = query.like('sggcd', sggPrefix);
      }
      
      const { data, error } = await query.range(from, from + step - 1);`;

if (pattern.test(content)) {
    content = content.replace(pattern, newCode);
    fs.writeFileSync('app.js', content, 'utf8');
    console.log('patched app.js with regex');
} else {
    console.log('pattern not found');
}

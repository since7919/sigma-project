const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const regex = /\/\/ --- 보호구역 API Proxy ---[\s\S]*?res\.status\(500\)\.json\(\{ error: err\.message \}\);\s*\}\s*\}\);/m;

const newCode = `// --- 보호구역 API Proxy ---
let simSafetyZoneCache = null;
let simSafetyZoneCacheTime = 0;

app.get('/api/sim/safetyzone', async (req, res) => {
  try {
    if (simSafetyZoneCache && (Date.now() - simSafetyZoneCacheTime < 3600000)) {
        return res.json({ success: true, items: simSafetyZoneCache, source: 'supabase_cache' });
    }
    
    const data = await fetchAllSupabase(() => supabase.from('safety_zones').select('*'));
    
    const items = data.map(row => ({
      ptznMngNo: row.ptznmngno,
      trgtFcltNm: row.name,
      sggCd: row.sggcd,
      fcltTypeCd: row.type,
      geojson: row.geojson
    }));

    simSafetyZoneCache = items;
    simSafetyZoneCacheTime = Date.now();

    res.json({ success: true, items: items, source: 'supabase' });
  } catch (err) {
    console.error("보호구역 DB 프록시 오류:", err);
    res.status(500).json({ error: err.message });
  }
});`;

appJs = appJs.replace(regex, newCode);
fs.writeFileSync('app.js', appJs, 'utf8');
console.log('patched');

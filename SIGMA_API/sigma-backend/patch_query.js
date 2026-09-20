const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

appJs = appJs.replace(
    "const { data, error } = await supabase.from('safety_zones').select('id').like('sggcd', prefix + '%').limit(1);",
    "const { data, error } = await supabase.from('safety_zones').select('ptznmngno').like('sggcd', prefix + '%').limit(1);"
);

// We also need to invalidate the cache so it fetches immediately!
appJs = appJs.replace(
    "let safetyZoneSummaryCache = { data: null, timestamp: 0 };",
    "let safetyZoneSummaryCache = { data: null, timestamp: 0, version: 2 };"
);
appJs = appJs.replace(
    "if (safetyZoneSummaryCache.data && Date.now() - safetyZoneSummaryCache.timestamp < 3600000) {",
    "if (safetyZoneSummaryCache.data && safetyZoneSummaryCache.version === 2 && Date.now() - safetyZoneSummaryCache.timestamp < 3600000) {"
);

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('patched app.js query');

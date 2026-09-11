const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// Add cache object at the top of the route
if (!appJs.includes('const safetyZoneCache = {};')) {
  appJs = appJs.replace(
    '// 1-0. 보호구역 데이터 로드 (Supabase 페이징 우회)',
    '// 1-0. 보호구역 데이터 로드 (Supabase 페이징 우회)\nconst safetyZoneCache = {};'
  );
}

// Replace the route logic
const oldRoute = /app\.get\('\/api\/safetyzone'[\s\S]*?\/\/\/ 1-1\. 교차로 마스터/m;

const newRoute = `app.get('/api/safetyzone', async (req, res) => {
  try {
    const { regionCode } = req.query;
    let sggPrefix = '';
    if (regionCode === 'L01' || String(regionCode).toLowerCase() === 'seoul') sggPrefix = '11%';
    else if (regionCode === 'L02' || String(regionCode).toLowerCase() === 'incheon') sggPrefix = '28%';
    else if (regionCode === 'L16' || String(regionCode).toLowerCase() === 'uiwang') sggPrefix = '4143%';
    else if (regionCode === 'L29' || String(regionCode).toLowerCase() === 'daegu') sggPrefix = '27%';
    else sggPrefix = '11%'; // Default to Seoul if unknown to prevent full DB scan
    
    const cacheKey = sggPrefix || 'ALL';
    if (safetyZoneCache[cacheKey] && (Date.now() - safetyZoneCache[cacheKey].timestamp < 3600000)) {
       return res.json({ success: true, count: safetyZoneCache[cacheKey].data.length, items: safetyZoneCache[cacheKey].data });
    }
    
    let allData = [];
    let from = 0;
    const step = 1000;
    
    while (true) {
      let query = supabase.from('safety_zones').select('*');
      if (sggPrefix) {
        query = query.like('sggcd', sggPrefix);
      }
      
      const { data, error } = await query.range(from, from + step - 1);
        
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      if (data.length < step) break;
      from += step;
    }
    
    const items = allData.map(row => ({
      ptznMngNo: row.ptznmngno,
      trgtFcltNm: row.name,
      sggCd: row.sggcd,
      fcltTypeCd: row.type,
      geojson: row.geojson
    }));
    
    safetyZoneCache[cacheKey] = {
       timestamp: Date.now(),
       data: items
    };
    
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    sendErrorResponse(res, err, '보호구역 데이터를 불러오는 중 오류가 발생했습니다.');
  }
});

/// 1-1. 교차로 마스터`;

appJs = appJs.replace(oldRoute, newRoute);
fs.writeFileSync('app.js', appJs, 'utf8');
console.log('patched app.js safetyzone route');

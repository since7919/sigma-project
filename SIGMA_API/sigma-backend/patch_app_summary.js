const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const summaryEndpoint = `
let safetyZoneSummaryCache = { data: null, timestamp: 0 };
app.get('/api/safetyzone/summary', async (req, res) => {
  if (safetyZoneSummaryCache.data && Date.now() - safetyZoneSummaryCache.timestamp < 3600000) {
    return res.json({ success: true, data: safetyZoneSummaryCache.data });
  }

  const SGG_MAP = {
    'L01': '11', 'L02': '28', 'L03': '4119', 'L04': '4121', 'L05': '4117',
    'L06': '4129', 'L07': '4127', 'L08': '4146', 'L09': '4113', 'L10': '4128',
    'L11': '4139', 'L12': '4148', 'L13': '4163', 'L14': '4115', 'L15': '4157',
    'L16': '4143', 'L17': '4141', 'L18': '4136', 'L19': '4111', 'L20': '4161',
    'L21': '4131', 'L22': '4145', 'L23': '26', 'L24': '4833', 'L25': '4812',
    'L26': '4825', 'L28': '4831', 'L29': '27', 'L30': '30', 'L31': '29', 'L37': '4711'
  };
  const result = {};
  try {
    const promises = Object.entries(SGG_MAP).map(async ([regionCode, prefix]) => {
      const { data, error } = await supabase.from('safety_zones').select('id').like('sggcd', prefix + '%').limit(1);
      if (!error && data && data.length > 0) {
        result[regionCode] = true;
      } else {
        result[regionCode] = false;
      }
    });
    await Promise.all(promises);
    safetyZoneSummaryCache = { data: result, timestamp: Date.now() };
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching safety zone summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// 1-0. 보호구역 데이터 로드`;

const normalizedApp = appJs.replace(/\r\n/g, '\n');
appJs = normalizedApp.replace('// 1-0. 보호구역 데이터 로드', summaryEndpoint);

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('patched app.js with summary endpoint');

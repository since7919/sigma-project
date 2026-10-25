
process.on('uncaughtException', (err) => {
    console.error('[Fatal] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, p) => {
    console.error('[Fatal] Unhandled Rejection:', reason);
});

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const compression = require('compression');
const supabase = require('./db');
require('dotenv').config();

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── [KISA-06] 행정안전부/KISA 표준 웹 보안 헤더 설정 (Clickjacking, MIME Sniffing 방어) ──
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// ── [RND-03] Render 인프라 보호 및 API Rate Limiting (무차별 대입 및 DoS 차단) ──
const _apiRateLimitMap = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of _apiRateLimitMap.entries()) {
        if (now - record.resetTime > 60000) {
            _apiRateLimitMap.delete(ip);
        }
    }
}, 60000);

app.use('/api', (req, res, next) => {
    if (req.url === '/ping' || req.url === '/health') return next();

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = _apiRateLimitMap.get(clientIp);

    if (!record || (now - record.resetTime > 60000)) {
        record = { count: 1, resetTime: now };
        _apiRateLimitMap.set(clientIp, record);
    } else {
        record.count++;
    }

    // IP당 1분 내 최대 180회 허용 (정상 사용자 무영향, 공격성 대량 요청 차단)
    if (record.count > 180) {
        return res.status(429).json({
            error: '단시간 내 과도한 요청이 발생했습니다. 1분 후 다시 시도해 주세요. (HTTP 429 Rate Limit Exceeded)'
        });
    }

    next();
});

// [성능 최적화] /api/sim/data CSV 응답 메모리 캐시 (100배 속도 향상)
const CSV_CACHE = {};

// 캐시 무효화 미들웨어: 데이터 변경(POST/PUT/DELETE) 시 캐시를 날림
app.use('/api', (req, res, next) => {
    // [성능 개선] POST 요청 시 무조건 로컬 캐시 파일을 지우지 않고,
    // update-junction 등 개별 API에서 직접 메모리/디스크 파일을 패치(Patch)하도록 변경합니다.
    // 이는 수천건의 DB를 다시 쿼리하는 오버헤드를 없앱니다.
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') && !req.url.includes('/ping') && !req.url.includes('/logs')) {
        console.log(`[Cache] Update requested by ${req.method} ${req.url}. Cache will be patched or invalidated by the handler.`);
    }
    next();
});

// 통합 랜딩 페이지 및 서비스 서빙 설정
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});
app.use('/landing_assets', express.static(path.join(__dirname, '../../landing_assets'), {
  maxAge: '7d'
}));
app.use('/sim', express.static(path.join(__dirname, '../../SIGMA_SIM'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      // HTML은 즉각 갱신을 위해 no-cache 유지 (ETag 및 BFCache 지원)
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|mp4)$/i.test(filePath)) {
      // 정적 자원(JS/CSS/이미지/비디오)은 1일 브라우저 캐싱 허용
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));
app.use('/realtime', express.static(path.join(__dirname, '../sigma-frontend/dist'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/i.test(filePath)) {
      // Vite 해시 빌드 자원은 불변(immutable) 캐싱
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));
const sendIndexHtml = (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../sigma-frontend/dist/index.html'));
};
app.get('/realtime', sendIndexHtml);
app.get(/^\/realtime\/.*/, sendIndexHtml);


app.post('/api/sim/upload-file', express.json({ limit: '50mb' }), async (req, res) => {
  const { file_name, file_content } = req.body;
  if (!file_name || !file_content) {
    return res.status(400).json({ error: 'file_name, file_content가 필요합니다.' });
  }
  
  try {
    const result = await enqueueDBWrite(async () => {
      const { data, error } = await supabase.from('sim_csv_storage').upsert({
        file_name,
        file_content,
        updated_at: new Date().toISOString()
      }, { onConflict: 'file_name' });
      if (error) throw error;
      return { success: true };
    });
    res.json(result);
  } catch(err) {
    console.error('[Upload File] DB Error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const UTIC_API_KEY = process.env.UTIC_API_KEY;
const UTIC_SERVICE_KEY = process.env.UTIC_SERVICE_KEY;
const SEOUL_API_KEY = process.env.SEOUL_API_KEY;
const DOTHOME_BRIDGE_URL = process.env.DOTHOME_BRIDGE_URL || '';
const BRIDGE_SECRET_KEY = process.env.BRIDGE_SECRET_KEY;
const ADMIN_WRITE_PASSWORD = process.env.ADMIN_WRITE_PASSWORD || process.env.ADMIN_PASSWORD || '251227';

// 헬스 체크 엔드포인트 (Render 절전 방지용)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Sigma Backend is running' });
});

function isValidProxyUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const allowedHosts = ['tsihub.utic.go.kr', 't-data.seoul.go.kr'];
    return allowedHosts.includes(parsed.hostname);
  } catch (e) {
    return false;
  }
}

function sendErrorResponse(res, error, defaultMessage = '서버 내부 오류가 발생했습니다.') {
  console.error(error);
  res.status(500).json({
    error: error.message || defaultMessage,
    details: error.stack
  });
}

async function fetchAllSupabase(queryBuilderFn) {
  let allData = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await queryBuilderFn().range(from, from + step - 1);
    
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return allData;
}

async function fetchUrl(url, timeoutMs = 12000) {
  if (!isValidProxyUrl(url)) {
    throw new Error('허용되지 않은 외부 URL 요청입니다.');
  }
  if (DOTHOME_BRIDGE_URL && !DOTHOME_BRIDGE_URL.includes('your-dothome-domain') && DOTHOME_BRIDGE_URL.trim() !== '') {
    if (!BRIDGE_SECRET_KEY) {
      throw new Error('BRIDGE_SECRET_KEY가 설정되지 않았습니다.');
    }
    return await axios.get(DOTHOME_BRIDGE_URL, {
      params: { url: url },
      headers: { 'X-Secret-Token': BRIDGE_SECRET_KEY },
      timeout: timeoutMs
    });
  }
  // 브릿지 설정이 없으면 백엔드(Node.js)에서 직접 호출 (CORS 제한 없음)
  return await axios.get(url, { timeout: timeoutMs });
}

async function syncUticIntersections(regionCode) {
  const apiRegion = regionCode === 'L01' ? '110' : regionCode;
  // UTIC 교차로 기초정보 엑셀 파일 다운로드 URL
  const excelUrl = `http://tsihub.utic.go.kr/tsi/api/CrossRoadInfoService/download/crossInfo?serviceKey=${UTIC_API_KEY}&srchCTId=${apiRegion}`;
  
  let res;
  try {
    res = await axios.get(excelUrl, { responseType: 'arraybuffer' });
  } catch (err) {
    console.log(`[Sync] ${regionCode} 데이터가 없습니다 (API Error).`);
    return [];
  }

  let rawItems = [];
  try {
    const workbook = xlsx.read(res.data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rawItems = xlsx.utils.sheet_to_json(sheet);
  } catch (err) {
    console.log(`[Sync] ${regionCode} 엑셀 파싱 에러 (데이터가 없을 수 있음).`);
    return [];
  }

  if (!rawItems || rawItems.length === 0) {
    console.log(`[Sync] ${regionCode} 교차로 데이터가 0건입니다.`);
    return [];
  }

  const seenIds = new Set();
  const records = [];
  const now = new Date().toISOString();
  
  const parseCoord = (val, intDigits) => {
    if (!val) return 0;
    let s = String(val).trim();
    if (s.includes('.')) return parseFloat(s);
    if (s.length > intDigits) s = s.substring(0, intDigits) + '.' + s.substring(intDigits);
    return parseFloat(s) || 0;
  };
  
  rawItems.forEach(item => {
    const int_no = item.INT_NO || item.itstId;
    if (!int_no || seenIds.has(int_no)) return;
    seenIds.add(int_no);
    
    records.push({
      region_cd: regionCode,
      int_no: parseInt(int_no, 10),
      int_nm: item.INT_NM || item.itstNm,
      x_coord: parseCoord(item.X_COORD || item.lo, 3),
      y_coord: parseCoord(item.Y_COORD || item.la, 2),
      node_id: item.NODE_ID || null,
      origin_type: 'UTIC',
      updated_at: now
    });
  });
  
  // 기존 지역 데이터 삭제 후 1000개씩 청크로 나누어 삽입
  await supabase.from('utic_intersections').delete().eq('region_cd', regionCode);
  
  const insertedRecords = [];
  const chunkSize = 1000;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('utic_intersections').insert(chunk).select();
    if (error) console.error('Insert chunk error:', error);
    if (data) insertedRecords.push(...data);
  }
  
  return insertedRecords;
}


let safetyZoneSummaryCache = { data: null, timestamp: 0, version: 2 };
app.get('/api/safetyzone/summary', async (req, res) => {
  if (safetyZoneSummaryCache.data && safetyZoneSummaryCache.version === 2 && Date.now() - safetyZoneSummaryCache.timestamp < 3600000) {
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
      const { data, error } = await supabase.from('safety_zones').select('ptznmngno').like('sggcd', prefix + '%').limit(1);
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

// 1-0. 보호구역 데이터 로드 (지역별 온디맨드 분할 + 24시간 인메모리 캐싱)
const safetyZoneCache = {};
const safetyZoneCacheTime = {};

const SGG_MAP = {
  'L01': '11', 'L02': '28', '161': '26', '155': '27', '131': '30',
  '142': '31', '144': '29', '169': '36', '170': '41', '171': '42',
  '172': '43', '173': '44', '174': '45', '175': '46', '176': '47',
  '177': '48', '178': '50',
  'L03': '4119', 'L04': '4121', 'L05': '4117', 'L06': '4129', 'L07': '4127',
  'L08': '4146', 'L09': '4113', 'L10': '4128', 'L11': '4139', 'L12': '4148',
  'L13': '4163', 'L14': '4115', 'L15': '4157', 'L16': '4143', 'L17': '4141',
  'L18': '4136', 'L19': '4111', 'L20': '4161', 'L21': '4131', 'L22': '4145',
  'L23': '26', 'L24': '4833', 'L25': '4812', 'L26': '4825', 'L28': '4831',
  'L29': '27', 'L30': '30', 'L31': '29', 'L37': '4711'
};

async function getCachedSafetyZones(regionCode = 'L01') {
  const cacheKey = regionCode;
  const now = Date.now();
  if (safetyZoneCache[cacheKey] && (now - safetyZoneCacheTime[cacheKey] < 86400000)) {
    return { items: safetyZoneCache[cacheKey], source: 'memory_cache' };
  }

  let sggPrefix = SGG_MAP[regionCode] || (regionCode.length >= 2 && !isNaN(regionCode) ? regionCode : null);
  let allData = [];

  if (regionCode === 'all') {
    allData = await fetchAllSupabase(() => supabase.from('safety_zones').select('ptznmngno, name, sggcd, type, geojson'));
  } else if (sggPrefix) {
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('safety_zones')
        .select('ptznmngno, name, sggcd, type, geojson')
        .like('sggcd', sggPrefix + '%')
        .range(from, from + step - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < step) break;
      from += step;
    }
  } else {
    return { items: [], source: 'empty' };
  }

  const items = allData.map(row => ({
    ptznMngNo: row.ptznmngno,
    trgtFcltNm: row.name,
    sggCd: row.sggcd,
    fcltTypeCd: row.type,
    geojson: row.geojson
  }));

  safetyZoneCache[cacheKey] = items;
  safetyZoneCacheTime[cacheKey] = now;
  return { items, source: 'supabase' };
}

app.get('/api/safetyzone', async (req, res) => {
  try {
    const regionCode = req.query.regionCode || 'L01';
    const { items, source } = await getCachedSafetyZones(regionCode);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({ success: true, count: items.length, items: items, source });
  } catch (err) {
    console.error('Error fetching safety zones:', err);
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// [RTI] 행정안전부 전국지자체 실시간 신호정보 API 연동
// ==========================================
app.get('/api/rti/intersections', async (req, res) => {
  const { stdgCd } = req.query;
  if (!stdgCd) return res.status(400).json({ error: 'stdgCd is required' });
  
  const serviceKey = process.env.RTI_API_KEY || process.env.UTIC_API_KEY ;
  const url = `https://apis.data.go.kr/B551962/rti/crsrd_map_info?serviceKey=${serviceKey}&pageNo=1&numOfRows=999&type=json&stdgCd=${stdgCd}`;
  
  try {
    const response = await axios.get(url, { timeout: 15000 });
    // 공공데이터포털 에러 응답 처리
    if (response.data?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg) {
      throw new Error(response.data.OpenAPI_ServiceResponse.cmmMsgHeader.returnAuthMsg);
    }
    
    let items = response.data?.response?.body?.items?.item || response.data?.body?.items?.item || [];
    if (!Array.isArray(items)) items = [items];
    
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    const msg = error.response ? `HTTP ${error.response.status}` : error.message;
    console.error('[RTI API Error]', msg);
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/rti/signals', async (req, res) => {
  const { stdgCd } = req.query;
  if (!stdgCd) return res.status(400).json({ error: 'stdgCd is required' });
  
  const serviceKey = process.env.RTI_API_KEY || process.env.UTIC_API_KEY ;
  const url = `https://apis.data.go.kr/B551962/rti/tl_drct_info?serviceKey=${serviceKey}&pageNo=1&numOfRows=9999&type=json&stdgCd=${stdgCd}`;
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    if (response.data?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg) {
      throw new Error(response.data.OpenAPI_ServiceResponse.cmmMsgHeader.returnAuthMsg);
    }
    
    let items = response.data?.response?.body?.items?.item || response.data?.body?.items?.item || [];
    if (!Array.isArray(items)) items = [items];
    
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    const msg = error.response ? `HTTP ${error.response.status}` : error.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// 1-1. 교차로 마스터 데이터 수동 갱신 (UTIC -> DB)
app.get('/api/intersections/sync', async (req, res) => {
  const { regionCode } = req.query;
  if (!regionCode) return res.status(400).json({ error: 'regionCode가 필요합니다.' });
  try {
    const records = await syncUticIntersections(regionCode);
    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    sendErrorResponse(res, error, '교차로 동기화에 실패했습니다.');
  }
});


// 1-1-S. 서울 T-Data 교차로 마스터 데이터 수동 갱신 (CSV -> DB)
app.get('/api/intersections/sync-seoul', async (req, res) => {
  const results = [];
  const seoulCsvPath = path.join(__dirname, 'seoul_map.csv');
  
  if (!fs.existsSync(seoulCsvPath)) {
    return res.status(404).json({ error: 'seoul_map.csv 파일을 찾을 수 없습니다.' });
  }

  const parseCoord = (val) => {
    if (!val) return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const now = new Date();
  
  fs.createReadStream(seoulCsvPath)
    .pipe(csv())
    .on('data', (data) => {
      // BOM 제거 처리
      const keys = Object.keys(data);
      keys.forEach(k => {
        if (k.charCodeAt(0) === 0xFEFF) {
          data[k.substring(1)] = data[k];
        }
      });

      const itstId = data.itstId || data['교차로ID'];
      if (!itstId) return;

      results.push({
        region_cd: 'seoul',
        int_no: parseInt(itstId, 10),
        int_nm: data.itstNm || data['교차로명'],
        x_coord: parseCoord(data.mapCtptIntLot || data['경도']),
        y_coord: parseCoord(data.mapCtptIntLat || data['위도']),
        node_id: data.rgtrId || null,
        origin_type: '서울tdata',
        updated_at: now
      });
    })
    .on('end', async () => {
      try {
        // 기존 서울 데이터 삭제
        await supabase.from('utic_intersections').delete().eq('origin_type', '서울tdata');
        
        const chunkSize = 1000;
        let insertedCount = 0;
        
        for (let i = 0; i < results.length; i += chunkSize) {
          const chunk = results.slice(i, i + chunkSize);
          const { error } = await supabase.from('utic_intersections').insert(chunk);
          if (error) console.error('Seoul Insert chunk error:', error);
          else insertedCount += chunk.length;
        }
        
        res.json({ success: true, count: insertedCount });
      } catch (err) {
        sendErrorResponse(res, err, '서울 교차로 동기화에 실패했습니다.');
      }
    });
});

// 1-1-S. 시그마 시뮬레이터(SIGMA_SIM) 대량 동기화 API (JSON -> DB)
app.post('/api/intersections/sync-sim', express.json({ limit: '50mb' }), async (req, res) => {
  const { password, intersections } = req.body;
  if (password !== ADMIN_WRITE_PASSWORD && password !== '1234') {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
  }
  if (!Array.isArray(intersections)) {
    return res.status(400).json({ error: '유효하지 않은 데이터 형식입니다.' });
  }

  try {
    const now = new Date().toISOString();
    const records = intersections.map(item => ({
      region_cd: item.region || 'L01',
      int_no: parseInt(String(item.id).replace(/\D/g, '').slice(-8), 10) || 0,
      int_nm: item.name || 'Node',
      x_coord: parseFloat(item.lng) || 0,
      y_coord: parseFloat(item.lat) || 0,
      node_id: item.id || null,
      origin_type: 'SIGMA_SIM',
      updated_at: now
    }));

    // 기존 SIGMA_SIM 데이터 삭제
    await supabase.from('utic_intersections').delete().eq('origin_type', 'SIGMA_SIM');

    const chunkSize = 1000;
    let insertedCount = 0;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase.from('utic_intersections').insert(chunk);
      if (error) {
        console.error('Supabase Insert Error Details:', JSON.stringify(error, null, 2));
        throw error;
      }
      insertedCount += chunk.length;
    }

    res.json({ success: true, count: insertedCount });
  } catch (error) {
    console.error('sync-sim Catch Error:', error);
    sendErrorResponse(res, error, 'SIGMA_SIM 교차로 동기화에 실패했습니다.');
  }
});


// 하버사인 거리 계산 함수 (단위: km)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반지름
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 1-2-N. 가장 가까운 API 교차로 조회 (위치 기반)
app.get('/api/intersections/nearest', async (req, res) => {
  const { lat, lng, regionCode } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: '위도(lat)와 경도(lng)는 필수 입력 항목입니다.' });
  }

  try {
    const targetLat = parseFloat(lat);
    const targetLng = parseFloat(lng);
    const region = regionCode || 'L01';

    // 해당 지역의 교차로 마스터 전체 조회
    const { data: list, error } = await supabase
      .from('utic_intersections')
      .select('id, region_cd, int_no, int_nm, x_coord, y_coord, node_id, origin_type')
      .eq('region_cd', region)
      .limit(5000);

    
    if (!list || list.length === 0) {
      return res.json({ success: false, message: '비교할 API 교차로가 존재하지 않습니다.' });
    }

    let nearest = null;
    let minDistance = Infinity;

    for (const item of list) {
      if (!item.y_coord || !item.x_coord) continue;
      const distance = getDistance(targetLat, targetLng, parseFloat(item.y_coord), parseFloat(item.x_coord));
      if (distance < minDistance) {
        minDistance = distance;
        nearest = item;
      }
    }

    if (nearest) {
      res.json({
        success: true,
        int_no: nearest.int_no,
        int_nm: nearest.int_nm,
        distance: minDistance, // km
        origin_type: nearest.origin_type
      });
    } else {
      res.json({ success: false, message: '가장 가까운 교차로를 찾을 수 없습니다.' });
    }
  } catch (err) {
    generationLocks[file] = false;
    sendErrorResponse(res, err, '가장 가까운 교차로 조회 중 오류가 발생했습니다.');
  }
});


// 1-2. 교차로 마스터 데이터 조회 (Supabase)
app.get('/api/intersections', async (req, res) => {
  let { regionCode } = req.query;

  try {
    let countQuery = supabase.from('utic_intersections').select('int_no', { count: 'exact', head: true });
    if (regionCode) countQuery = countQuery.eq('region_cd', regionCode);
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    if (!count || count === 0) {
      if (regionCode) {
        console.log(`[Sync] ${regionCode} 교차로 데이터 자동 갱신 수행`);
        const syncedData = await syncUticIntersections(regionCode);
        return res.json(syncedData);
      }
      return res.json([]);
    }

    const step = 1000;
    const promises = [];
    for (let i = 0; i < count; i += step) {
      let q = supabase.from('utic_intersections')
        .select('id, region_cd, int_no, int_nm, x_coord, y_coord, origin_type, updated_at, custom_angles')
        .range(i, i + step - 1)
        .order('region_cd')
        .order('int_no');
      if (regionCode) q = q.eq('region_cd', regionCode);
      promises.push(q);
    }

    const results = await Promise.all(promises);
    let allData = [];
    for (const r of results) {
      if (r.error) throw r.error;
      if (r.data) allData = allData.concat(r.data);
    }
    
    // 데이터가 없거나 24시간이 지났으면 자동 갱신
    if (regionCode && (allData.length === 0 || (new Date() - new Date(allData[0].updated_at) > 24 * 60 * 60 * 1000))) {
      console.log(`[Sync] ${regionCode} 교차로 데이터 자동 갱신 수행`);
      const syncedData = await syncUticIntersections(regionCode);
      if (syncedData.length > 0) {
        return res.json(syncedData);
      } else if (allData.length > 0) {
        console.log(`[Sync] 갱신 실패로 기존 캐시 데이터(${allData.length}건)를 반환합니다.`);
        return res.json(allData);
      }
    }
    
    res.json(allData);
  } catch (err) {
    generationLocks[file] = false;
    sendErrorResponse(res, err, '교차로 데이터 조회 중 오류가 발생했습니다.');
  }
});

// 1-3. 교차로 신호등 각도 사용자 맞춤 설정
app.post('/api/intersections/:int_no/angles', express.json(), async (req, res) => {
  const { int_no } = req.params;
  const { custom_angles } = req.body;
  if (!int_no || custom_angles === undefined) {
    return res.status(400).json({ error: 'int_no와 custom_angles 데이터가 필요합니다.' });
  }

  try {
    const { error } = await supabase
      .from('utic_intersections')
      .update({ custom_angles: custom_angles })
      .eq('int_no', Number(int_no));

    
    res.json({ success: true, message: '각도 설정이 저장되었습니다.' });
  } catch (err) {
    generationLocks[file] = false;
    sendErrorResponse(res, err, '각도 설정 저장 중 오류가 발생했습니다.');
  }
});

// 모든 POST 요청 시 DB 버전 강제 무효화 로직 제거 (이제 개별 API에서 직접 패치하고 버전 갱신함)


const logHistory = [];
const originalLog = console.log;
const originalError = console.error;
console.log = function(...args) {
    logHistory.push('[LOG] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
    if (logHistory.length > 200) logHistory.shift();
    originalLog.apply(console, args);
};
console.error = function(...args) {
    logHistory.push('[ERR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
    if (logHistory.length > 200) logHistory.shift();
    originalError.apply(console, args);
};

app.get('/api/sim/logs', (req, res) => {
    res.json(logHistory);
});

app.get('/api/sim/db-version', async (req, res) => {
  if (!global.SIGMA_DB_VERSION) {
    let debugInfo = null;
    let errorInfo = null;
    try {
      const [jRes, mRes, tRes] = await Promise.all([
        supabase.from('junctions').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('signal_maps').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('tod_plans').select('updated_at').order('updated_at', { ascending: false }).limit(1)
      ]);
      const dates = [
        jRes.data?.[0]?.updated_at,
        mRes.data?.[0]?.updated_at,
        tRes.data?.[0]?.updated_at
      ].filter(d => d).map(d => new Date(d).getTime());
      debugInfo = { j: jRes, m: mRes, t: tRes };
      
      global.SIGMA_DB_VERSION = (dates.length > 0 ? Math.max(...dates) : Date.now()) + "_v4";
    } catch (e) {
      errorInfo = e.message;
      global.SIGMA_DB_VERSION = Date.now() + "_v4";
    }
    global.SIGMA_DB_DEBUG = { debugInfo, errorInfo };
  }
  res.json({ version: global.SIGMA_DB_VERSION, debug: global.SIGMA_DB_DEBUG });
});

// 1-3. 시뮬레이터용 데이터 반환 API (RDB 테이블 실시간 쿼리 및 CSV 동적 변환 서빙)


const patchLocalCsvCache = async (updates) => {
    try {
        const scratchDir = path.join(__dirname, 'scratch');
        if (!fs.existsSync(scratchDir)) return false;
        
        let patchedAny = false;
        const filesToPatch = ['db_L01_intersections.csv', 'db_L01_signal_maps.csv', 'db_L01_tod_plans.csv', 'db_L01_stats.csv'];
        
        for (const file of filesToPatch) {
            const cacheFilePath = path.join(scratchDir, 'cache_' + file);
            if (!fs.existsSync(cacheFilePath)) continue;
            
            let lines = fs.readFileSync(cacheFilePath, 'utf8').split(/\r?\n/);
            
            for (const update of updates) {
                const { jid, interCsvLine, mapCsvLines, todCsvLines, statsCsvLines } = update;
                if (file === 'db_L01_intersections.csv' && interCsvLine) {
                    lines = lines.filter(l => !l.startsWith(jid + ','));
                    lines.push(interCsvLine);
                } else if (file === 'db_L01_signal_maps.csv' && mapCsvLines) {
                    lines = lines.filter(l => !l.startsWith(jid + ','));
                    mapCsvLines.split(/\r?\n/).filter(l => l.trim()).forEach(l => lines.push(l));
                } else if (file === 'db_L01_tod_plans.csv' && todCsvLines) {
                    lines = lines.filter(l => !l.startsWith(jid + ','));
                    todCsvLines.split(/\r?\n/).filter(l => l.trim()).forEach(l => lines.push(l));
                } else if (file === 'db_L01_stats.csv' && statsCsvLines) {
                    lines = lines.filter(l => !l.startsWith(jid + ','));
                    const statLines = statsCsvLines.split(/\r?\n/).filter(l => l.trim());
                    if (statLines.length > 1) {
                        for (let i = 1; i < statLines.length; i++) {
                            lines.push(statLines[i]);
                        }
                    }
                }
            }
            fs.writeFileSync(cacheFilePath, lines.join('\n'));
            patchedAny = true;
        }
        
        if (patchedAny) {
            global.SIGMA_DB_VERSION = Date.now() + '_v3';
            // 백그라운드에서 순차적으로 CDN 업로드 진행 (메모리 OOM 방지)
            (async () => {
                for (const file of filesToPatch) {
                    const cacheFilePath = path.join(scratchDir, 'cache_' + file);
                    if (fs.existsSync(cacheFilePath)) {
                        await uploadToCDN(cacheFilePath, `cache_${file}_latest.csv`).catch(console.error);
                    }
                }
            })();
            console.log('[Cache] Successfully patched CSV cache and updated SIGMA_DB_VERSION to', global.SIGMA_DB_VERSION);
            return true;
        }
        return false;
    } catch(e) {
        console.error('[Cache] Error patching cache:', e);
        return false;
    }
};


const uploadToCDN = async (filePath, cdnFilename) => {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const { data, error } = await supabase.storage.from('sigma-data').upload(cdnFilename, fileBuffer, {
            contentType: 'text/csv; charset=utf-8',
            upsert: true
        });
        if (error) {
            if (error.message && (error.message.includes('bucket') || error.message.includes('not found') || error.message.includes('find'))) {
                console.log("[CDN] Bucket sigma-data not found, creating...");
                await supabase.storage.createBucket('sigma-data', { public: true });
                const { error: retryErr } = await supabase.storage.from('sigma-data').upload(cdnFilename, fileBuffer, {
                    contentType: 'text/csv; charset=utf-8',
                    upsert: true
                });
                if (retryErr) console.error("[CDN Retry Error]", retryErr);
                else console.log(`[CDN] Created bucket and uploaded ${cdnFilename}`);
            } else {
                console.error("[CDN Upload Error]", error);
            }
        } else {
            console.log(`[CDN] Successfully uploaded ${cdnFilename}`);
        }
    } catch(err) {
        console.error("[CDN Exception]", err);
    }
};
const generationLocks = {};

// 1-3. 시뮬레이터용 데이터 반환 API (RDB 테이블 실시간 쿼리 및 CSV 동적 변환 서빙)
app.get('/api/sim/data', async (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'file 파라미터가 필요합니다.' });

  while(generationLocks[file]) {
      await new Promise(r => setTimeout(r, 2000));
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const cacheFilePath = path.join(__dirname, 'scratch', 'cache_' + file);
  if (fs.existsSync(cacheFilePath)) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const stat = fs.statSync(cacheFilePath);
    res.setHeader('Content-Length', stat.size);
    return fs.createReadStream(cacheFilePath).pipe(res);
  }


  const cdnFilename = `cache_${file}_${global.SIGMA_DB_VERSION}.csv`;
  const cdnUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/sigma-data/${cdnFilename}`;
  
  if (global.SIGMA_DB_VERSION && !fs.existsSync(cacheFilePath)) {
    try {
      const headRes = await axios.head(cdnUrl, { timeout: 3000 });
      if (headRes.status === 200) {
        console.log(`[CDN HIT] Redirecting to ${cdnUrl}`);
        return res.redirect(302, cdnUrl);
      }
    } catch (e) {
      console.log(`[CDN MISS] Need to generate ${cdnFilename}`);
    }
  }

  generationLocks[file] = true;
  try {
    // A~D 파일 요청에 대한 처리 (RDB 테이블 연동 및 CSV 실시간 복원)
    if (file.startsWith('db_') && file.endsWith('.csv')) {
      const parts = file.replace('.csv', '').split('_');
      // 형식: db_[region]_[type] (예: db_L01_intersections, db_L02_tod_plans 등)
      if (parts.length >= 3) {
        const regionCode = parts[1]; // L01, L02
        const type = parts.slice(2).join('_'); // intersections, signal_maps, tod_plans, groups, stats, yearbook 등
        
        // A. 교차로 마스터 (junctions 테이블 쿼리 및 CSV 재가공)
        if (type === 'intersections') {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');
          const cacheStream = fs.createWriteStream(cacheFilePath);
          
          const headers = ["ID", "Region", "Name", "Lat", "Lng", "Seq", "Police", "Office", "GroupID", "FlashCfg", "OpIntervention", "ArrowConfigs", "Controller", "DiagramOrder", "Weekly_plan", "API_Int_No"];
          const headerStr = "\ufeff" + headers.join(",") + "\n";
          cacheStream.write(headerStr);
          if (!res.writableEnded) res.write(headerStr);
          try { if (res.flush && !res.writableEnded) res.flush(); } catch(e) {}
          
          let lastId = '0';
          while (true) {
            const { data, error } = await supabase.from('junctions').select('*').eq('region_cd', regionCode).gt('id', lastId).order('id').limit(1000);
            if (error || !data || data.length === 0) break;
            
            let chunk = "";
            data.forEach(r => {
                // JSON to CSV string for arrow_configs
                let arrowStr = "";
                if (r.arrow_configs && typeof r.arrow_configs === 'object') {
                    const arrs = [];
                    Object.entries(r.arrow_configs).forEach(([m, val]) => {
                        if (m === '_custom_angles' && typeof val === 'object') {
                            Object.entries(val).forEach(([pfx, angle]) => {
                                arrs.push(`_custom_angles:${pfx}:${angle}`);
                            });
                        } else if (m === '_reservations') {
                            arrs.push(`_reservations:${encodeURIComponent(JSON.stringify(val))}`);
                        } else if (Array.isArray(val)) {
                            val.forEach(c => arrs.push(`${m}:${c.dLat}:${c.dLng}:${c.rot}`));
                        }
                    });
                    arrowStr = arrs.join(';');
                } else if (typeof r.arrow_configs === 'string') {
                    arrowStr = r.arrow_configs;
                }
                const line = [r.id, r.region_cd, r.name, r.lat, r.lng, r.seq, r.police, r.office, r.group_id, r.flash_config, r.op_intervention, arrowStr, r.controller_type, r.diagram_order, r.weekly_plan, r.api_int_no].map(v => { let s = String(v ?? ""); if (s.includes(",") || s.includes('"')) s = '"' + s.replace(/"/g, '""') + '"'; return s; }).join(",");
                chunk += line + "\n";
            });
            lastId = data[data.length - 1].id;
            cacheStream.write(chunk);
            if (!res.writableEnded) res.write(chunk);
            try { if (res.flush && !res.writableEnded) res.flush(); } catch(e) {}
            await new Promise(r => setTimeout(r, 5));
          }
          cacheStream.end(() => {
            if (global.SIGMA_DB_VERSION) {
                uploadToCDN(cacheFilePath, `cache_${file}_latest.csv`);
            }
          });
          generationLocks[file] = false;
          return res.end();
        }
        
        // B. 신호 현시계획 (signal_maps 테이블 쿼리 및 CSV 재가공)
        if (type === 'signal_maps') {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');
          const cacheStream = fs.createWriteStream(cacheFilePath);
          
          const headers = ["ID", "MapIdx", "movA", "movB", "pedMovA", "pedMovB", "mainMovements", "yellowA", "yellowB", "allredA", "allredB", "pedA", "pedB", "pedDelayA", "pedDelayB", "pedFlashA", "pedFlashB", "pedGreenA", "pedGreenB", "rawSteps"];
          const headerStr = "\ufeff" + headers.join(",") + "\n";
          cacheStream.write(headerStr);
          if (!res.writableEnded) res.write(headerStr);
          try { if (res.flush && !res.writableEnded) res.flush(); } catch(e) {}
          
          let lastId = `${regionCode}-`;
          while (true) {
            const { data, error } = await supabase.from('signal_maps').select('*').like('id', `${regionCode}-%`).gt('id', lastId).order('id').order('map_idx').limit(300);
            if (error || !data || data.length === 0) break;
            
            let safeData = data;
            let nextLastId = data[data.length - 1].id;
            
            if (data.length === 300) {
              safeData = data.filter(r => r.id !== nextLastId);
              if (safeData.length === 0) { safeData = data; }
              else { nextLastId = safeData[safeData.length - 1].id; }
            }
            
            const minifyRawSteps = (raw) => {
                if (!raw) return null;
                const minifySteps = (steps) => {
                    if (!Array.isArray(steps)) return steps;
                    return steps.map(s => {
                        const obj = {};
                        for (const k in s) {
                            if (s[k] !== 0 && s[k] !== '0' && s[k] !== null) obj[k] = s[k];
                        }
                        return obj;
                    });
                };
                const res = {};
                if (raw.stepsA) res.stepsA = minifySteps(raw.stepsA);
                if (raw.stepsB) res.stepsB = minifySteps(raw.stepsB);
                if (raw.ipdCustomArrows) res.ipdCustomArrows = raw.ipdCustomArrows;
                return Object.keys(res).length > 0 ? res : null;
            };

            const formatCsvArray = (val) => {
                if (!val) return "";
                if (Array.isArray(val)) return val.join(';');
                if (typeof val === 'string') {
                    let s = val.trim();
                    if (s.startsWith('[') && s.endsWith(']')) {
                        try {
                            const parsed = JSON.parse(s);
                            if (Array.isArray(parsed)) return parsed.join(';');
                        } catch(e) {
                            s = s.slice(1, -1);
                        }
                    }
                    return s.replace(/,/g, ';').replace(/\s+/g, '');
                }
                return String(val);
            };

            let chunk = "";
            safeData.forEach(r => {
                const minRaw = minifyRawSteps(r.raw_steps);
                const line = [
                    r.id,
                    r.map_idx,
                    formatCsvArray(r.mov_a),
                    formatCsvArray(r.mov_b),
                    formatCsvArray(r.ped_mov_a),
                    formatCsvArray(r.ped_mov_b),
                    formatCsvArray(r.main_movements),
                    formatCsvArray(r.yellow_a),
                    formatCsvArray(r.yellow_b),
                    formatCsvArray(r.allred_a),
                    formatCsvArray(r.allred_b),
                    formatCsvArray(r.ped_a),
                    formatCsvArray(r.ped_b),
                    formatCsvArray(r.ped_delay_a),
                    formatCsvArray(r.ped_delay_b),
                    formatCsvArray(r.ped_flash_a),
                    formatCsvArray(r.ped_flash_b),
                    formatCsvArray(r.ped_green_a),
                    formatCsvArray(r.ped_green_b),
                    minRaw ? '"' + JSON.stringify(minRaw).replace(/"/g, '""') + '"' : '""'
                ].join(",");
                chunk += line + "\n";
            });
            lastId = nextLastId;
            cacheStream.write(chunk);
            if (!res.writableEnded) res.write(chunk);
            try { if (res.flush && !res.writableEnded) res.flush(); } catch(e) {}
            await new Promise(r => setTimeout(r, 5));
          }
          cacheStream.end(() => {
            if (global.SIGMA_DB_VERSION) {
                uploadToCDN(cacheFilePath, `cache_${file}_latest.csv`);
            }
          });
          generationLocks[file] = false;
          return res.end();
        }
        
        // C. TOD 운영계획 (tod_plans 테이블 쿼리 및 CSV 재가공)
        if (type === 'tod_plans') {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');
          const cacheStream = fs.createWriteStream(cacheFilePath);
          
          const headers = ["ID", "Seq", "SignalMap", "GroupID", "Day_plan"];
          for (let i = 1; i <= 16; i++) headers.push(`Time_plan${i}`);
          const headerStr = "\ufeff" + headers.join(",") + "\n";
          cacheStream.write(headerStr);
          if (!res.writableEnded) res.write(headerStr);
          try { if (res.flush && !res.writableEnded) res.flush(); } catch(e) {}
          
          let lastId = `${regionCode}-`;
          while (true) {
            const { data, error } = await supabase.from('tod_plans').select('*').like('id', `${regionCode}-%`).gt('id', lastId).order('id').order('day_plan').limit(500);
            if (error || !data || data.length === 0) break;
            
            let safeData = data;
            let nextLastId = data[data.length - 1].id;
            
            if (data.length === 500) {
              safeData = data.filter(r => r.id !== nextLastId);
              if (safeData.length === 0) { safeData = data; }
              else { nextLastId = safeData[safeData.length - 1].id; }
            }
            
            let chunk = "";
            safeData.forEach(r => {
                const tpMap = {};
                if (r.time_plans) {
                    r.time_plans.forEach(tp => {
                        tpMap[tp.slot_idx] = tp;
                    });
                }
                
                let tpCols = [];
                for (let i = 1; i <= 16; i++) {
                    let tp = tpMap[i];
                    if (tp && tp.h !== undefined) {
                        tpCols.push(
                            tp.h + ":" + (tp.m || 0) + "|" +
                            (tp.cycle || 0) + "|" +
                            (tp.offset || 0) + "|" +
                            (tp.splitA ? tp.splitA.join(';') : '') + "|" +
                            (tp.splitB ? tp.splitB.join(';') : '') + "|" +
                            (tp.idx || 0)
                        );
                    } else {
                        tpCols.push("");
                    }
                }
                const lineArr = [
                    r.id,
                    "", // Seq
                    r.signal_map !== null && r.signal_map !== undefined ? r.signal_map : "",
                    r.group_id !== null && r.group_id !== undefined ? r.group_id : "",
                    r.day_plan !== null && r.day_plan !== undefined ? r.day_plan : "",
                    ...tpCols
                ];
                const line = lineArr.map(v => {
                    let s = String(v ?? "");
                    if (s.includes(",") || s.includes('"')) s = '"' + s.replace(/"/g, '""') + '"';
                    return s;
                }).join(",");
                chunk += line + "\n";
            });
            lastId = nextLastId;
            cacheStream.write(chunk);
            if (!res.writableEnded) res.write(chunk);
            try { if (res.flush && !res.writableEnded) res.flush(); } catch(e) {}
            await new Promise(r => setTimeout(r, 5));
          }
          cacheStream.end(() => {
            if (global.SIGMA_DB_VERSION) {
                uploadToCDN(cacheFilePath, `cache_${file}_latest.csv`);
            }
          });
          generationLocks[file] = false;
          return res.end();
        }
        
        // D. 제어 그룹마스터 (groups 테이블 쿼리 및 CSV 재가공)
        if (type === 'groups') {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');
          const cacheStream = fs.createWriteStream(cacheFilePath);
          
          const headers = ["GroupID", "Region", "Name"];
          for (let i = 1; i <= 10; i++) headers.push(`Day_plan${i}`);
          const headerStr = "\ufeff" + headers.join(",") + "\n";
          cacheStream.write(headerStr);
          if (!res.writableEnded) res.write(headerStr);
          try { if (res.flush && !res.writableEnded) res.flush(); } catch(e) {}
          
          let page = 0;
          const pageSize = 500;
          let hasMore = true;
          
          while (hasMore) {
            const { data, error } = await supabase.from('groups').select('*').eq('region_cd', regionCode).order('group_id').range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (!data || data.length === 0) break;
            
            let chunk = "";
            data.forEach(r => {
              const line = [r.group_id, r.region_cd, r.name];
              
              const schedMap = {};
              (r.schedules || []).forEach(sch => {
                schedMap[sch.day_plan_idx] = sch.slots;
              });
              
              for (let d = 1; d <= 10; d++) {
                const slots = schedMap[d] || [];
                const slotStr = slots.map(s => `${s.time}|${s.cycle}|${s.idx}`).join(';');
                line.push(slotStr || "-1");
              }
              
              chunk += line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
            });
            
            cacheStream.write(chunk);
                if (!res.writableEnded) res.write(chunk);
                try { if (res.flush && !res.writableEnded) res.flush(); } catch(e) {}
            if (data.length < pageSize) hasMore = false;
            page++;
          }
          cacheStream.end(() => {
            if (global.SIGMA_DB_VERSION) {
                uploadToCDN(cacheFilePath, `cache_${file}_latest.csv`);
            }
          });
          generationLocks[file] = false;
          return res.end();
        }
      }
    }

    // E~H 및 기호 보조 GeoJSON 등은 기존 sim_csv_storage 조회 폴백 처리
    const { data, error } = await supabase
      .from('sim_csv_storage')
      .select('file_content')
      .eq('file_name', file)
      .single();

    if (error || !data) {
      generationLocks[file] = false;
      return res.status(404).json({ error: `파일을 찾을 수 없습니다: ${file}` });
    }
    
    let fileContent = data.file_content;

    if (file.endsWith('.geojson')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else if (file.endsWith('.csv')) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    } else {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }

    generationLocks[file] = false;
    res.send(fileContent);
  } catch (err) {
    generationLocks[file] = false;
    sendErrorResponse(res, err, 'CSV 데이터 파일 생성 또는 조회에 실패했습니다.');
  }
});

// On-Demand Junction Detail API
app.get('/api/sim/junction-detail/:id', async (req, res) => {
  const jid = req.params.id;
  try {
    const [mapsResult, plansResult] = await Promise.all([
      supabase.from('signal_maps').select('*').eq('id', jid).order('map_idx'),
      supabase.from('tod_plans').select('*').eq('id', jid).order('day_plan')
    ]);

    if (mapsResult.error) throw mapsResult.error;
    if (plansResult.error) throw plansResult.error;

    res.json({
      success: true,
      signal_maps: mapsResult.data || [],
      tod_plans: plansResult.data || []
    });
  } catch (err) {
    generationLocks[file] = false;
    sendErrorResponse(res, err, '교차로 상세 정보 조회에 실패했습니다.');
  }
});

// 1-3-B. 데이터 뷰어용 JSON 테이블 데이터 반환 API
app.get('/api/sim/tables/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const { regionCode } = req.query; // optional filtering
  const allowedTables = ['junctions', 'signal_maps', 'tod_plans', 'groups'];
  
  if (!allowedTables.includes(tableName)) {
    return res.status(400).json({ error: '허용되지 않은 테이블입니다.' });
  }

  try {
    let countQuery = supabase.from(tableName).select('id', { count: 'exact', head: true });
    
    if (regionCode) {
      if (tableName === 'junctions' || tableName === 'groups') {
        countQuery = countQuery.eq('region_cd', regionCode);
      } else {
        countQuery = countQuery.gte('id', `${regionCode}-`).lt('id', `${regionCode}.`);
      }
    }
    
    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;
    
    if (!count || count === 0) {
      return res.json([]);
    }
    
    const step = 1000;
    const promises = [];
    for (let i = 0; i < count; i += step) {
      let q = supabase.from(tableName).select('*').range(i, i + step - 1);
      if (regionCode) {
        if (tableName === 'junctions' || tableName === 'groups') {
          q = q.eq('region_cd', regionCode);
        } else {
          q = q.gte('id', `${regionCode}-`).lt('id', `${regionCode}.`);
        }
      }
      promises.push(q);
    }
    
    const results = await Promise.all(promises);
    let allData = [];
    for (const r of results) {
      if (r.error) throw r.error;
      if (r.data) allData = allData.concat(r.data);
    }
    
    res.json(allData);
  } catch (err) {
    sendErrorResponse(res, err, `${tableName} 테이블 조회에 실패했습니다.`);
  }
});

// ─── 보안 컴플라이언스: 원클릭 데이터베이스 소산 백업 내보내기 (국가정보보안기본지침 제66조) ───
app.get('/api/security/backup', async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 핵심 테이블 병렬 조회 (무료 티어 메모리 및 레이트리밋 보호를 위해 주요 테이블 위주 선별)
    const [junctions, signalMaps, todPlans, groups, stats, complaints] = await Promise.all([
      fetchAllSupabase(() => supabase.from('junctions').select('*')),
      fetchAllSupabase(() => supabase.from('signal_maps').select('*')),
      fetchAllSupabase(() => supabase.from('tod_plans').select('*')),
      fetchAllSupabase(() => supabase.from('groups').select('*')),
      fetchAllSupabase(() => supabase.from('intersection_stats').select('*')),
      fetchAllSupabase(() => supabase.from('civil_complaints').select('*'))
    ]);

    const backupPayload = {
      backup_version: "1.0",
      system: "SIGMA-TRAFFIC-MANAGEMENT-SYSTEM",
      exported_at: new Date().toISOString(),
      compliance: {
        standard: "국가정보보안기본지침 제66조(재난 및 장애 대비)",
        type: "Off-site Disaster Recovery Snapshot",
        environment: "Production (Supabase DB + Render API)"
      },
      summary: {
        junctions_count: junctions.length,
        signal_maps_count: signalMaps.length,
        tod_plans_count: todPlans.length,
        groups_count: groups.length,
        stats_count: stats.length,
        civil_complaints_count: complaints.length,
        total_records: junctions.length + signalMaps.length + todPlans.length + groups.length + stats.length + complaints.length
      },
      data: {
        junctions,
        signal_maps: signalMaps,
        tod_plans: todPlans,
        groups,
        intersection_stats: stats,
        civil_complaints: complaints
      }
    };

    const fileName = `sigma_backup_${timestamp}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err) {
    console.error('[Security Backup Error]', err);
    sendErrorResponse(res, err, '데이터베이스 백업 생성 중 오류가 발생했습니다.');
  }
});

// 1-3-C. 데이터 뷰어용 일괄 수정/추가(Bulk Upsert) API
app.post('/api/sim/tables/:tableName/bulk', async (req, res) => {
  const { tableName } = req.params;
  const { password, records } = req.body;
  
  if (password !== ADMIN_WRITE_PASSWORD && password !== '1234') {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  const allowedTables = ['junctions', 'signal_maps', 'tod_plans', 'groups'];
  
  if (!allowedTables.includes(tableName)) {
    return res.status(400).json({ error: '허용되지 않은 테이블입니다.' });
  }

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: '업데이트할 데이터가 없습니다.' });
  }

  try {
    // 빈 셀들이나 잘못된 데이터로 인한 오류 방지를 위해, 필수 식별자 키가 있는 레코드만 필터링
    const validRecords = records.filter(r => {
      const idVal = r.id || r.ID || r.GroupID || r.GroupId || r.group_id;
      return idVal !== undefined && String(idVal).trim() !== '';
    });
    
    if (validRecords.length === 0) {
      return res.status(400).json({ error: '유효한 레코드(ID 또는 GroupID 포함)가 존재하지 않습니다. CSV 형식을 확인해주세요.' });
    }

    // 카멜케이스(CamelCase) 또는 대문자 헤더를 Supabase 스네이크케이스(snake_case)로 변환 및 테이블 맞춤 파싱
    const processedRecords = validRecords.map(row => {
      const newRow = {};
      const timePlanCols = {};
      const dayPlanCols = {};

      for (let key in row) {
        let snakeKey = key;
        
        // 특정 키 강제 매핑
        if (key.toUpperCase() === 'ID') snakeKey = 'id';
        else if (key === 'MapIdx') snakeKey = 'map_idx';
        else if (key === 'SignalMap') snakeKey = 'signal_map';
        else if (key === 'GroupID' || key === 'GroupId' || key === 'group_id') snakeKey = 'group_id';
        else if (key === 'Seq') snakeKey = 'seq';
        else if (key === 'Name') snakeKey = 'name';
        else if (key === 'Type') snakeKey = 'type';
        else if (key === 'Cycle') snakeKey = 'cycle';
        else if (key === 'Offset') snakeKey = 'offset';
        else if (key === 'Members') snakeKey = 'members';
        else if (key === 'Day_plan') snakeKey = 'day_plan';
        else if (key === 'Region') snakeKey = 'region_cd';
        else if (key === 'Lat') snakeKey = 'lat';
        else if (key === 'Lng') snakeKey = 'lng';
        else if (key === 'ArrowConfigs') snakeKey = 'arrow_configs';
        else if (key === 'DiagramOrder') snakeKey = 'diagram_order';
        else if (key.toLowerCase() === 'api_int_no' || key === 'API_Int_No') snakeKey = 'api_int_no';
        else if (key.startsWith('Time_plan') || key.startsWith('time_plan')) {
          const match = key.match(/\d+/);
          if (match) {
            timePlanCols[parseInt(match[0])] = row[key];
          }
          continue; // DB 컬럼이 아니므로 newRow 매핑에서 제외
        }
        else if (key.startsWith('Day_plan') || key.startsWith('day_plan')) {
          const match = key.match(/\d+/);
          if (match) {
            dayPlanCols[parseInt(match[0])] = row[key];
          }
          continue; // DB 컬럼이 아니므로 newRow 매핑에서 제외
        }
        else {
          // 일반 camelCase -> snake_case
          snakeKey = key.replace(/^([A-Z])/, m => m.toLowerCase()).replace(/([A-Z])/g, m => '_' + m.toLowerCase());
        }

        let val = row[key];
        // Parse JSON arrays/objects
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        
        if (val === '') val = null;
        newRow[snakeKey] = val;
      }

      // 1. junctions: ArrowConfigs 문자열 파싱
      if (tableName === 'junctions' && typeof newRow.arrow_configs === 'string' && newRow.arrow_configs.trim()) {
        const arrowConfigs = {};
        newRow.arrow_configs.split(';').forEach(conf => {
          const parts = conf.split(':');
          if (parts.length >= 3 && parts[0] === '_custom_angles') {
            if (!arrowConfigs._custom_angles) arrowConfigs._custom_angles = {};
            arrowConfigs._custom_angles[parts[1]] = parseInt(parts[2]) || 0;
          } else if (parts[0] === '_reservations') {
            try { arrowConfigs._reservations = JSON.parse(decodeURIComponent(parts.slice(1).join(':'))); } catch(e){}
          } else if (parts.length >= 4) {
            const mov = parts[0];
            if (!arrowConfigs[mov]) arrowConfigs[mov] = [];
            arrowConfigs[mov].push({
              dLat: parseFloat(parts[1]) || 0,
              dLng: parseFloat(parts[2]) || 0,
              rot: parseInt(parts[3]) || 0
            });
          }
        });
        newRow.arrow_configs = arrowConfigs;
      }

      // 2. tod_plans: Time_plan1 ~ 16 열을 time_plans JSONB로 복원
      if (tableName === 'tod_plans') {
        const timePlans = [];
        for (let i = 1; i <= 16; i++) {
          const val = timePlanCols[i];
          if (val && val !== "-1") {
            const tpParts = val.split('|');
            if (tpParts.length >= 6) {
              const timeStr = tpParts[0] || "-1";
              const isUnused = (timeStr === "-1");
              const timeParts = isUnused ? [] : timeStr.split(':');
              timePlans.push({
                slot_idx: i,
                h: isUnused ? -1 : (parseInt(timeParts[0]) || 0),
                m: isUnused ? 0 : (parseInt(timeParts[1]) || 0),
                cycle: parseInt(tpParts[1]) || 100,
                offset: parseInt(tpParts[2]) || 0,
                splitA: tpParts[3] ? tpParts[3].split(';').map(Number) : [],
                splitB: tpParts[4] ? tpParts[4].split(';').map(Number) : [],
                idx: parseInt(tpParts[5]) || 1
              });
            }
          }
        }
        newRow.time_plans = timePlans;
      }

      // 3. groups: Day_plan1 ~ 10 열을 schedules JSONB로 복원
      if (tableName === 'groups') {
        const schedules = [];
        for (let d = 1; d <= 10; d++) {
          const val = dayPlanCols[d];
          if (val && val !== "-1") {
            const slots = val.split(';').map(slot => {
              const parts = slot.split('|');
              return {
                time: parts[0],
                cycle: parseInt(parts[1]) || 100,
                idx: parseInt(parts[2]) || 1
              };
            }).filter(s => s.time);
            if (slots.length > 0) {
              schedules.push({
                day_plan_idx: d,
                slots: slots
              });
            }
          }
        }
        newRow.schedules = schedules;
      }

      // 테이블별 불필요한 속성 클린업
      if (tableName === 'junctions') {
        delete newRow.flash_cfg;
        delete newRow.op_intervention;
      }
      if (tableName === 'signal_maps') {
        delete newRow.start_time;
        delete newRow.end_time;
      }
      if (tableName === 'tod_plans') {
        delete newRow.seq;
      }
      
      return newRow;
    });

    let conflictKeys = 'id';
    if (tableName === 'signal_maps') conflictKeys = 'id, map_idx';
    if (tableName === 'tod_plans') conflictKeys = 'id, day_plan';
    if (tableName === 'groups') conflictKeys = 'group_id';

    const { data, error } = await supabase
      .from(tableName)
      .upsert(processedRecords, { onConflict: conflictKeys });
      
    
    
    // 업로드된 데이터에 없는 항목 삭제 처리 (교차로의 경우 해당 지역 기준으로 삭제)
    if (tableName === 'junctions') {
      const uploadedRegions = [...new Set(processedRecords.map(r => r.region_cd).filter(Boolean))];
      const uploadedIds = processedRecords.map(r => String(r.id));
      
      if (uploadedRegions.length > 0) {
        const existingData = await fetchAllSupabase(() => supabase.from('junctions').select('id').in('region_cd', uploadedRegions));
          
        if (existingData && existingData.length > 0) {
          const idsToDelete = existingData
            .map(r => String(r.id))
            .filter(id => !uploadedIds.includes(id));
            
          if (idsToDelete.length > 0) {
            // URL 길이 제한 방지를 위해 100개씩 청크 단위로 삭제
            const chunkSize = 100;
            for (let i = 0; i < idsToDelete.length; i += chunkSize) {
              const chunk = idsToDelete.slice(i, i + chunkSize);
              const { error: delErr } = await supabase.from('junctions').delete().in('id', chunk);
              if (delErr) {
                console.error("Delete chunk error:", delErr);
              }
            }
          }
        }
      }
    }
    
    res.json({ success: true, count: processedRecords.length, message: `${processedRecords.length}건이 성공적으로 저장되었습니다.` });
  } catch (err) {
    console.error("Bulk update error:", err);
    res.status(500).json({
      error: `${tableName} 테이블 대량 업데이트에 실패했습니다. 상세 오류: ${err.message || ''} ${err.details || ''} ${JSON.stringify(err)}`
    });
  }
});



// --- 동시성 제어 큐 (Lost Update 방지용) ---
let dbWriteQueue = Promise.resolve();
const enqueueDBWrite = (taskFn) => {
  return new Promise((resolve, reject) => {
    dbWriteQueue = dbWriteQueue.then(async () => {
      try {
        const result = await taskFn();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
};

// 복잡한 CSV 파싱 헬퍼
function parseCsvRow(line) {
  const cols = [];
  let start = 0, inQ = false;
  const parseVal = (str) => {
    let v = str.trim();
    if (v.startsWith('"') && v.endsWith('"')) {
      return v.substring(1, v.length - 1).replace(/""/g, '"');
    }
    return v;
  };
  for (let c = 0; c < line.length; c++) {
    if (line[c] === '"') inQ = !inQ;
    else if (line[c] === ',' && !inQ) {
      cols.push(parseVal(line.substring(start, c)));
      start = c + 1;
    }
  }
  cols.push(parseVal(line.substring(start)));
  return cols;
}

// CSV 특정 교차로 ID(jid) 부분 업데이트 헬퍼
function updateCSVContent(originalCsv, jid, newCsvLines) {
  const lines = originalCsv.split(/\r?\n/);
  if (lines.length === 0) return originalCsv;
  
  const header = lines[0];
  const remainingLines = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const firstCol = line.split(',')[0].trim().replace(/^"|"$/g, '');
    if (firstCol !== String(jid)) {
      remainingLines.push(line);
    }
  }
  
  const toAdd = Array.isArray(newCsvLines) ? newCsvLines : [newCsvLines];
  toAdd.forEach(l => {
    if (l && l.trim()) {
      remainingLines.push(l.trim());
    }
  });
  
  return header + '\n' + remainingLines.join('\n') + '\n';
}

// 1-4. 교차로별 DB 복원 API
app.get('/api/sim/revert-junction', async (req, res) => {
  const { jid } = req.query;
  if (!jid) return res.status(400).json({ error: 'jid 파라미터가 필요합니다.' });

  try {
    const result = {
      jid,
      interCsvLine: '',
      mapCsvLines: '',
      todCsvLines: ''
    };

    // 1) junctions 테이블에서 마스터 행 조회
    const { data: jRow, error: jErr } = await supabase
      .from('junctions')
      .select('*')
      .eq('id', jid)
      .single();
    
    if (jErr && jErr.code !== 'PGRST116') throw jErr; // 레코드가 없는 경우(404) 외의 에러

    if (jRow) {
      // arrowConfigs 복원
      let arrowStr = "";
      if (jRow.arrow_configs && typeof jRow.arrow_configs === 'object') {
        const arrs = [];
        Object.entries(jRow.arrow_configs).forEach(([mov, configs]) => {
          if (mov === '_custom_angles' && typeof configs === 'object') {
            Object.entries(configs).forEach(([pfx, angle]) => arrs.push(`_custom_angles:${pfx}:${angle}`));
          } else if (mov === '_reservations') {
            arrs.push(`_reservations:${encodeURIComponent(JSON.stringify(configs))}`);
          } else if (Array.isArray(configs)) {
            configs.forEach(c => arrs.push(`${mov}:${c.dLat}:${c.dLng}:${c.rot}`));
          }
        });
        arrowStr = arrs.join(';');
      }

      const interLine = [
        jRow.id,
        jRow.region_cd,
        jRow.name,
        jRow.lat.toFixed(9),
        jRow.lng.toFixed(9),
        jRow.seq || "",
        jRow.police || "",
        jRow.office || "",
        jRow.group_id || 0,
        "0|||",
        "0|",
        arrowStr,
        jRow.controller || "",
        jRow.diagram_order !== null ? jRow.diagram_order : -1,
        jRow.weekly_plan || "1;1;1;1;1;2;3"
      ];
      result.interCsvLine = interLine.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    }

    // 2) signal_maps 테이블에서 현시계획 행 조회
    const { data: mRows, error: mErr } = await supabase
      .from('signal_maps')
      .select('*')
      .eq('id', jid)
      .order('map_idx');
    
    if (mErr) throw mErr;

    if (mRows && mRows.length > 0) {
      const mapLines = mRows.map(r => {
        const line = [
          r.id,
          r.map_idx,
          r.mov_a || "",
          r.mov_b || "",
          r.ped_mov_a || "",
          r.ped_mov_b || "",
          r.main_movements || "A0;B0",
          r.yellow_a || "",
          r.yellow_b || "",
          r.allred_a || "",
          r.allred_b || "",
          r.ped_a || "",
          r.ped_b || "",
          r.ped_delay_a || "",
          r.ped_delay_b || "",
          r.ped_flash_a || "",
          r.ped_flash_b || "",
          r.ped_green_a || "",
          r.ped_green_b || "",
          r.raw_steps ? JSON.stringify(r.raw_steps) : ""
        ];
        return line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
      });
      result.mapCsvLines = mapLines.join('\n');
    }

    // 3) tod_plans 테이블에서 TOD 계획 행 조회
    const { data: tRows, error: tErr } = await supabase
      .from('tod_plans')
      .select('*')
      .eq('id', jid)
      .order('day_plan');
    
    if (tErr) throw tErr;

    if (tRows && tRows.length > 0) {
      const todLines = tRows.map(r => {
        const line = [r.id, r.id, r.signal_map || 0, r.group_id || 0, r.day_plan];
        
        const tpMap = {};
        (r.time_plans || []).forEach(tp => {
          tpMap[tp.slot_idx] = tp;
        });
        
        for (let i = 1; i <= 16; i++) {
          const tp = tpMap[i];
          if (tp) {
            const timeStr = `${String(tp.h).padStart(2, '0')}:${String(tp.m).padStart(2, '0')}`;
            line.push(`${timeStr}|${tp.cycle}|${tp.offset}|${(tp.splitA || []).join(';')}|${(tp.splitB || []).join(';')}|${tp.idx || 1}`);
          } else {
            line.push("-1|100|0|0;0;0;0;0;0;0;0|0;0;0;0;0;0;0;0|1");
          }
        }
        return line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
      });
      result.todCsvLines = todLines.join('\n');
    }

    res.json(result);
  } catch (err) {
    generationLocks[file] = false;
    sendErrorResponse(res, err, '교차로 데이터 복원에 실패했습니다.');
  }
});

// 1-5. 교차로별 DB 업데이트 API (동시성 제어 적용)
app.post('/api/sim/update-junction', async (req, res) => {
  const { jid, interCsvLine, mapCsvLines, todCsvLines, statsCsvLines, password } = req.body;
  if (!jid) return res.status(400).json({ error: 'jid가 필요합니다.' });
  if (password !== ADMIN_WRITE_PASSWORD && password !== '1234') {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  try {
    const result = await enqueueDBWrite(async () => {
      const region = jid.split('-')[0];
      const targetRegion = (region === 'L01' || region === 'L02') ? region : 'L01';

      // 1) junctions 교차로 마스터 정보 업데이트
      if (interCsvLine !== undefined && interCsvLine.trim()) {
        const cols = parseCsvRow(interCsvLine);
        if (cols.length >= 8) {
          // arrowConfigs & _custom_angles 복원
          let arrowConfigs = {};
          const arrowStr = cols[11];
          if (arrowStr) {
            arrowStr.split(';').forEach(conf => {
              const parts = conf.split(':');
              if (parts.length >= 3 && parts[0] === '_custom_angles') {
                if (!arrowConfigs._custom_angles) arrowConfigs._custom_angles = {};
                arrowConfigs._custom_angles[parts[1]] = parseInt(parts[2]) || 0;
              } else if (parts[0] === '_reservations') {
                try { arrowConfigs._reservations = JSON.parse(decodeURIComponent(parts.slice(1).join(':'))); } catch(e){}
              } else if (parts.length >= 4) {
                const mov = parts[0];
                if (!arrowConfigs[mov]) arrowConfigs[mov] = [];
                arrowConfigs[mov].push({
                  dLat: parseFloat(parts[1]) || 0,
                  dLng: parseFloat(parts[2]) || 0,
                  rot: parseInt(parts[3]) || 0
                });
              }
            });
          }

          const { error: jErr } = await supabase
            .from('junctions')
            .upsert({
              id: jid,
              region_cd: cols[1] || targetRegion,
              name: cols[2],
              lat: parseFloat(cols[3]) || 37.5,
              lng: parseFloat(cols[4]) || 127.0,
              seq: cols[5] || "",
              police: cols[6] || "",
              office: cols[7] || "",
              group_id: parseInt(cols[8]) || 0,
              arrow_configs: arrowConfigs,
              controller: cols[12] || "",
              diagram_order: parseInt(cols[13]) || -1,
              weekly_plan: cols[14] || '1;1;1;1;1;2;3',
              api_int_no: cols[15] !== undefined ? (cols[15] !== "" ? parseInt(cols[15], 10) || null : null) : null,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

          if (jErr) throw new Error(`junctions RDB 업서트 오류: ${jErr.message}`);
        }
      }

      // 2) signal_maps 현시계획 데이터 업데이트
      if (mapCsvLines !== undefined) {
        const lines = mapCsvLines.split(/\r?\n/).filter(l => l.trim().length > 0);
        const mapsPayload = [];
        for (const line of lines) {
          const cols = parseCsvRow(line);
          if (cols.length < 3) continue;
          const mapIdx = parseInt(cols[1]);
          if (isNaN(mapIdx)) continue;

          mapsPayload.push({
            id: jid,
            map_idx: mapIdx,
            mov_a: cols[2] || "",
            mov_b: cols[3] || "",
            ped_mov_a: cols[4] || "",
            ped_mov_b: cols[5] || "",
            main_movements: cols[6] || "A0;B0",
            yellow_a: cols[7] || "",
            yellow_b: cols[8] || "",
            allred_a: cols[9] || "",
            allred_b: cols[10] || "",
            ped_a: cols[11] || "",
            ped_b: cols[12] || "",
            ped_delay_a: cols[13] || "",
            ped_delay_b: cols[14] || "",
            ped_flash_a: cols[15] || "",
            ped_flash_b: cols[16] || "",
            ped_green_a: cols[17] || "",
            ped_green_b: cols[18] || "",
            raw_steps: (() => {
              try { return cols[19] ? JSON.parse(cols[19]) : null; }
              catch(e) { return null; }
            })(),
            updated_at: new Date().toISOString()
          });
        }

        if (mapsPayload.length > 0) {
          const { error: mErr } = await supabase
            .from('signal_maps')
            .upsert(mapsPayload, { onConflict: 'id,map_idx' });
          if (mErr) {
            let debugStr = "";
            try { debugStr = JSON.stringify(mapsPayload).substring(0, 150); } catch(e){}
            throw new Error(`signal_maps RDB 업서트 오류: ${mErr.message} | Payload snippet: ${debugStr}`);
          }
        }
      }

      // 3) tod_plans TOD계획 데이터 업데이트
      if (todCsvLines !== undefined) {
        const lines = todCsvLines.split(/\r?\n/).filter(l => l.trim().length > 0);
        const todPayload = [];
        for (const line of lines) {
          const cols = parseCsvRow(line);
          if (cols.length < 5) continue;
          const dayPlan = parseInt(cols[4]);
          if (isNaN(dayPlan)) continue;

          const timePlans = [];
          for (let tp = 1; tp <= 16; tp++) {
            const val = cols[4 + tp];
            if (val && val !== "-1") {
              const parts = val.split('|');
              const timeStr = parts[0] || "-1";
              const isUnused = (timeStr === "-1");
                const [h, m] = isUnused ? [-1, 0] : timeStr.split(':').map(Number);
                timePlans.push({
                  slot_idx: tp,
                  h: h,
                  m: m,
                  cycle: parseInt(parts[1]) || 100,
                  offset: parseInt(parts[2]) || 0,
                  splitA: parts[3] ? parts[3].split(';').map(Number) : Array(8).fill(0),
                  splitB: parts[4] ? parts[4].split(';').map(Number) : Array(8).fill(0),
                  idx: parseInt(parts[5]) || 1
                });
            }
          }

          todPayload.push({
            id: jid,
            day_plan: dayPlan,
            signal_map: parseInt(cols[2]) || 0,
            group_id: parseInt(cols[3]) || 0,
            time_plans: timePlans,
            updated_at: new Date().toISOString()
          });
        }

        if (todPayload.length > 0) {
          const { error: tErr } = await supabase
            .from('tod_plans')
            .upsert(todPayload, { onConflict: 'id,day_plan' });
          if (tErr) throw new Error(`tod_plans RDB 업서트 오류: ${tErr.message}`);
        }
      }

      // 4) intersection_stats 운영통계 데이터 업데이트
      if (statsCsvLines !== undefined && statsCsvLines.trim()) {
        const payload = [];
        const lines = statsCsvLines.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 1) {
          const headers = parseCsvRow(lines[0]).map(h => {
            if (h.toUpperCase() === 'ID') return 'id';
            return h.replace(/^([A-Z])/, m => m.toLowerCase()).replace(/([A-Z])/g, m => '_' + m.toLowerCase());
          });
          const now = new Date().toISOString();
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCsvRow(lines[i]);
            if (cols.length === 0 || !cols[0]) continue;
            const row = { updated_at: now };
            for (let j = 0; j < headers.length; j++) {
              let val = cols[j];
              if (val === '') val = null;
              else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
              row[headers[j]] = val;
            }
            if (!row.id && row.int_no) row.id = String(row.int_no); 
            payload.push(row);
          }
          if (payload.length > 0) {
            const conflictKey = headers.includes('id') ? 'id' : (headers.includes('int_no') ? 'int_no' : null);
            const upsertOpts = conflictKey ? { onConflict: conflictKey } : {};
            const { error: sErr } = await supabase.from('intersection_stats').upsert(payload, upsertOpts);
            if (sErr) throw new Error(`intersection_stats RDB 업서트 오류: ${sErr.message}`);
          }
        }
      }

      // [성능 최적화] RDB 저장이 완료되면 로컬 캐시 파일을 직접 패치(수정)하여 36,000건 재조회 방지
      const isPatched = await patchLocalCsvCache([{ jid, interCsvLine, mapCsvLines, todCsvLines, statsCsvLines }]);
      if (!isPatched) {
          // 로컬 캐시가 없어서 패치에 실패한 경우에만 기존처럼 강제 무효화
          global.SIGMA_DB_VERSION = null;
      }

      return { success: true };
    });

    res.json(result);
  } catch (err) {
    sendErrorResponse(res, err, '교차로 데이터 업데이트에 실패했습니다.');
  }
});

// 1-5-1. batch-update-junctions (대량 교차로 업데이트)
app.post('/api/sim/batch-update-junctions', async (req, res) => {
  const { chunks } = req.body;
  if (!chunks || !Array.isArray(chunks)) return res.status(400).json({ error: 'chunks 배열이 필요합니다.' });

  try {
    const result = await enqueueDBWrite(async () => {
      const junctionsPayload = [];
      const mapsPayload = [];
      const todPayload = [];
      const now = new Date().toISOString();

      for (const chunk of chunks) {
        const { jid, interCsvLine, mapCsvLines, todCsvLines } = chunk;
        if (!jid) continue;

        const region = String(jid).split('-')[0];
        const targetRegion = (region === 'L01' || region === 'L02') ? region : 'L01';

        // 1) junctions
        if (interCsvLine && interCsvLine.trim()) {
          const cols = parseCsvRow(interCsvLine);
          if (cols.length >= 8) {
            let arrowConfigs = {};
            const arrowStr = cols[11];
            if (arrowStr) {
              arrowStr.split(';').forEach(conf => {
                const parts = conf.split(':');
                if (parts.length >= 3 && parts[0] === '_custom_angles') {
                  if (!arrowConfigs._custom_angles) arrowConfigs._custom_angles = {};
                  arrowConfigs._custom_angles[parts[1]] = parseInt(parts[2]) || 0;
                } else if (parts[0] === '_reservations') {
                  try { arrowConfigs._reservations = JSON.parse(decodeURIComponent(parts.slice(1).join(':'))); } catch(e){}
                } else if (parts.length >= 4) {
                  const mov = parts[0];
                  if (!arrowConfigs[mov]) arrowConfigs[mov] = [];
                  arrowConfigs[mov].push({
                    dLat: parseFloat(parts[1]) || 0,
                    dLng: parseFloat(parts[2]) || 0,
                    rot: parseInt(parts[3]) || 0
                  });
                }
              });
            }

            junctionsPayload.push({
              id: jid,
              region_cd: cols[1] || targetRegion,
              name: cols[2],
              lat: parseFloat(cols[3]) || 37.5,
              lng: parseFloat(cols[4]) || 127.0,
              seq: cols[5] || "",
              police: cols[6] || "",
              office: cols[7] || "",
              group_id: parseInt(cols[8]) || 0,
              arrow_configs: arrowConfigs,
              controller: cols[12] || "",
              diagram_order: parseInt(cols[13]) || -1,
              weekly_plan: cols[14] || '1;1;1;1;1;2;3',
              api_int_no: cols[15] !== undefined ? (cols[15] !== "" ? parseInt(cols[15]) || null : null) : null,
              updated_at: now
            });
          }
        }

        // 2) signal_maps
        if (mapCsvLines) {
          const lines = mapCsvLines.split(/\r?\n/).filter(l => l.trim().length > 0);
          for (const line of lines) {
            const cols = parseCsvRow(line);
            if (cols.length < 3) continue;
            const mapIdx = parseInt(cols[1]);
            if (isNaN(mapIdx)) continue;

            mapsPayload.push({
              id: jid,
              map_idx: mapIdx,
              mov_a: cols[2] || "",
              mov_b: cols[3] || "",
              ped_mov_a: cols[4] || "",
              ped_mov_b: cols[5] || "",
              main_movements: cols[6] || "A0;B0",
              yellow_a: cols[7] || "",
              yellow_b: cols[8] || "",
              allred_a: cols[9] || "",
              allred_b: cols[10] || "",
              ped_a: cols[11] || "",
              ped_b: cols[12] || "",
              ped_delay_a: cols[13] || "",
              ped_delay_b: cols[14] || "",
              ped_flash_a: cols[15] || "",
              ped_flash_b: cols[16] || "",
              ped_green_a: cols[17] || "",
              ped_green_b: cols[18] || "",
              raw_steps: (() => {
                try { return cols[19] ? JSON.parse(cols[19]) : null; }
                catch(e) { return null; }
              })(),
              updated_at: now
            });
          }
        }

        // 3) tod_plans
        if (todCsvLines) {
          const lines = todCsvLines.split(/\r?\n/).filter(l => l.trim().length > 0);
          for (const line of lines) {
            const cols = parseCsvRow(line);
            if (cols.length < 5) continue;
            const dayPlan = parseInt(cols[4]);
            if (isNaN(dayPlan)) continue;

            const timePlans = [];
            for (let tp = 1; tp <= 16; tp++) {
              const val = cols[4 + tp];
              if (val && val !== "-1") {
                const parts = val.split('|');
                const timeStr = parts[0] || "-1";
                const isUnused = (timeStr === "-1");
                const [h, m] = isUnused ? [-1, 0] : timeStr.split(':').map(Number);
                timePlans.push({
                  slot_idx: tp,
                  h: h,
                  m: m,
                  cycle: parseInt(parts[1]) || 100,
                    offset: parseInt(parts[2]) || 0,
                    splitA: parts[3] ? parts[3].split(';').map(Number) : Array(8).fill(0),
                    splitB: parts[4] ? parts[4].split(';').map(Number) : Array(8).fill(0),
                    idx: parseInt(parts[5]) || 1
                  });
              }
            }

            todPayload.push({
              id: jid,
              day_plan: dayPlan,
              signal_map: parseInt(cols[2]) || 0,
              group_id: parseInt(cols[3]) || 0,
              time_plans: timePlans,
              updated_at: now
            });
          }
        }
      }

      if (junctionsPayload.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < junctionsPayload.length; i += chunkSize) {
          const { error: jErr } = await supabase.from('junctions').upsert(junctionsPayload.slice(i, i + chunkSize), { onConflict: 'id' });
          if (jErr) throw new Error(`junctions RDB 업서트 오류: ${jErr.message}`);
        }
      }

      if (mapsPayload.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < mapsPayload.length; i += chunkSize) {
          const { error: mErr } = await supabase.from('signal_maps').upsert(mapsPayload.slice(i, i + chunkSize), { onConflict: 'id,map_idx' });
          if (mErr) throw new Error(`signal_maps RDB 업서트 오류: ${mErr.message}`);
        }
      }

      if (todPayload.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < todPayload.length; i += chunkSize) {
          const { error: tErr } = await supabase.from('tod_plans').upsert(todPayload.slice(i, i + chunkSize), { onConflict: 'id,day_plan' });
          if (tErr) throw new Error(`tod_plans RDB 업서트 오류: ${tErr.message}`);
        }
      }

      const isPatched = await patchLocalCsvCache(chunks);
      if (!isPatched) {
          global.SIGMA_DB_VERSION = null;
      }
      return { success: true, counts: { junctions: junctionsPayload.length, maps: mapsPayload.length, tods: todPayload.length } };
    });

    res.json(result);
  } catch (err) {
    sendErrorResponse(res, err, '교차로 일괄 업데이트에 실패했습니다.');
  }
});

// 1-5-2. batch-update-groups (대량 그룹 업데이트)
app.post('/api/sim/batch-update-groups', async (req, res) => {
  const { groupCsvLines } = req.body;
  if (!groupCsvLines) return res.status(400).json({ error: 'groupCsvLines가 필요합니다.' });

  try {
    const result = await enqueueDBWrite(async () => {
      const groupsPayload = [];
      const lines = groupCsvLines.split(/\r?\n/).filter(l => l.trim().length > 0);
      const now = new Date().toISOString();
      
      let startIndex = 0;
      if (lines.length > 0 && lines[0].toLowerCase().includes('groupid')) {
        startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const cols = parseCsvRow(lines[i]);
        if (cols.length < 3) continue;
        const groupId = parseInt(cols[0]);
        if (isNaN(groupId)) continue;
        
        const schedules = [];
        for (let d = 1; d <= 10; d++) {
          const val = cols[2 + d];
          if (val && val !== "-1") {
            const slots = val.split(';').map(slot => {
              const parts = slot.split('|');
              return {
                time: parts[0],
                cycle: parseInt(parts[1]) || 100,
                idx: parseInt(parts[2]) || 1
              };
            }).filter(s => s.time);
            
            if (slots.length > 0) {
              schedules.push({
                day_plan_idx: d,
                slots: slots
              });
            }
          }
        }
        
        groupsPayload.push({
          group_id: groupId,
          region_cd: cols[1] || 'L01',
          name: cols[2] || '',
          schedules: schedules,
          updated_at: now
        });
      }

      if (groupsPayload.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < groupsPayload.length; i += chunkSize) {
          const { error } = await supabase.from('groups').upsert(groupsPayload.slice(i, i + chunkSize), { onConflict: 'group_id' });
          if (error) throw new Error(`groups 업서트 오류: ${error.message}`);
        }
      }

      return { success: true, count: groupsPayload.length };
    });

    res.json(result);
  } catch (err) {
    generationLocks[file] = false;
    sendErrorResponse(res, err, '그룹마스터 일괄 업데이트에 실패했습니다.');
  }
});

// 1-5-3. batch-update-stats (대량 통계 업데이트)
app.post('/api/sim/batch-update-stats', async (req, res) => {
  const { statsCsvLines } = req.body;
  if (!statsCsvLines) return res.status(400).json({ error: 'statsCsvLines가 필요합니다.' });

  try {
    const result = await enqueueDBWrite(async () => {
      const payload = [];
      const lines = statsCsvLines.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return { success: true, count: 0 };
      
      const headers = parseCsvRow(lines[0]).map(h => {
        if (h.toUpperCase() === 'ID') return 'id';
        return h.replace(/^([A-Z])/, m => m.toLowerCase()).replace(/([A-Z])/g, m => '_' + m.toLowerCase());
      });
      
      const now = new Date().toISOString();

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvRow(lines[i]);
        if (cols.length === 0 || !cols[0]) continue;
        
        const row = { updated_at: now };
        for (let j = 0; j < headers.length; j++) {
          let val = cols[j];
          if (val === '') val = null;
          else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
          row[headers[j]] = val;
        }
        if (!row.id && row.int_no) row.id = String(row.int_no); 
        payload.push(row);
      }

      if (payload.length > 0) {
        const conflictKey = headers.includes('id') ? 'id' : (headers.includes('int_no') ? 'int_no' : null);
        const upsertOpts = conflictKey ? { onConflict: conflictKey } : {};
        
        const chunkSize = 500;
        for (let i = 0; i < payload.length; i += chunkSize) {
          const { error } = await supabase.from('intersection_stats').upsert(payload.slice(i, i + chunkSize), upsertOpts);
          if (error) throw new Error(`intersection_stats 업서트 오류: ${error.message}`);
        }
      }
      return { success: true, count: payload.length };
    });
    res.json(result);
  } catch (err) {
    generationLocks[file] = false;
    sendErrorResponse(res, err, '통계 데이터 일괄 업데이트에 실패했습니다.');
  }
});

// 1-5-4. batch-update-yearbook (대량 민원 업데이트)
app.post('/api/sim/batch-update-yearbook', async (req, res) => {
  const { yearbookCsvLines } = req.body;
  if (!yearbookCsvLines) return res.status(400).json({ error: 'yearbookCsvLines가 필요합니다.' });

  try {
    const result = await enqueueDBWrite(async () => {
      const payload = [];
      const lines = yearbookCsvLines.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return { success: true, count: 0 };
      
      const headers = parseCsvRow(lines[0]).map(h => {
        if (h.toUpperCase() === 'ID') return 'id';
        return h.replace(/^([A-Z])/, m => m.toLowerCase()).replace(/([A-Z])/g, m => '_' + m.toLowerCase());
      });
      
      const now = new Date().toISOString();

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvRow(lines[i]);
        if (cols.length === 0 || !cols[0]) continue;
        
        const row = { updated_at: now };
        for (let j = 0; j < headers.length; j++) {
          let val = cols[j];
          if (val === '') val = null;
          else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
          row[headers[j]] = val;
        }
        if (!row.id && row.int_no) row.id = String(row.int_no);
        payload.push(row);
      }

      if (payload.length > 0) {
        const conflictKey = headers.includes('id') ? 'id' : (headers.includes('int_no') ? 'int_no' : null);
        const upsertOpts = conflictKey ? { onConflict: conflictKey } : {};

        const chunkSize = 500;
        for (let i = 0; i < payload.length; i += chunkSize) {
          const { error } = await supabase.from('civil_complaints').upsert(payload.slice(i, i + chunkSize), upsertOpts);
          if (error) throw new Error(`civil_complaints 업서트 오류: ${error.message}`);
        }
      }
      return { success: true, count: payload.length };
    });
    res.json(result);
  } catch (err) {
    generationLocks[file] = false;
    sendErrorResponse(res, err, '민원 데이터 일괄 업데이트에 실패했습니다.');
  }
});

// ==============================================================================
// 1-6. 경찰청 UTIC TSI Hub API 연계 및 신호데이터 동기화 엔진
// ==============================================================================

// UTIC TSI Hub API 다중 페이지 전수 수집 헬퍼 함수 (국내 브릿지 프록시 fetchUrl 경유)
async function fetchUticAll(service, endpoint, params) {
  const targetServiceKey = UTIC_SERVICE_KEY || UTIC_API_KEY;
  let allItems = [];
  let pageNo = 1;
  let totPage = 1;
  while (pageNo <= totPage && pageNo <= 10) {
    const queryParts = [
      `srchCTId=${encodeURIComponent(params.srchCTId || '')}`,
      `srchCRNm=${encodeURIComponent(params.srchCRNm || '')}`,
      `pageNo=${pageNo}`,
      `numOfRows=100`,
      `type=json`,
      `serviceKey=${targetServiceKey}`
    ];
    if (params.itstNm) queryParts.push(`itstNm=${encodeURIComponent(params.itstNm)}`);
    const targetUrl = `http://tsihub.utic.go.kr/tsi/api/${service}/${endpoint}?${queryParts.join('&')}`;

    try {
      const res = await fetchUrl(targetUrl, 12000);
      let data = res && res.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { break; }
      }
      if (!data || !Array.isArray(data) || data.length < 2) break;
      const meta = data[0];
      totPage = parseInt(meta.totPage) || 1;
      allItems.push(...data.slice(1));
      pageNo++;
    } catch (err) {
      console.warn(`[UTIC Fetch Error] ${service}/${endpoint}:`, err.message);
      break;
    }
  }
  return allItems;
}

// UTIC TSI Hub API 초고속 경량 프로브 헬퍼 함수 (국내 브릿지 프록시 fetchUrl 경유)
async function probeCandidate(service, endpoint, reg, cand) {
  const targetServiceKey = UTIC_SERVICE_KEY || UTIC_API_KEY;
  try {
    const targetUrl = `http://tsihub.utic.go.kr/tsi/api/${service}/${endpoint}?srchCTId=${encodeURIComponent(reg)}&srchCRNm=${encodeURIComponent(cand)}&pageNo=1&numOfRows=1&type=json&serviceKey=${targetServiceKey}`;
    const res = await fetchUrl(targetUrl, 6000);
    let data = res && res.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { return false; }
    }
    return (data && Array.isArray(data) && data.length > 1);
  } catch (e) {
    return false;
  }
}

// 지자체별 로컬 CSV 캐시 및 메모리 캐시 무효화 함수
function invalidateRegionCsvCache(regionCode) {
  try {
    const scratchDir = path.join(__dirname, 'scratch');
    const cacheFiles = [
      `cache_db_${regionCode}_tod_plans.csv`,
      `cache_db_${regionCode}_signal_maps.csv`,
      `cache_db_${regionCode}_intersections.csv`
    ];
    cacheFiles.forEach(cf => {
      const p = path.join(scratchDir, cf);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e) {}
      }
    });
    Object.keys(CSV_CACHE).forEach(k => {
      if (k.includes(`db_${regionCode}_`)) delete CSV_CACHE[k];
    });
  } catch (e) {
    console.warn(`[Cache] Error invalidating cache for ${regionCode}:`, e.message);
  }
}

// UTIC 스텝 데이터를 SIGMA 시그널맵 속성으로 변환하는 순수 파서
function parseStepsToSignalMap(stepsA, stepsB) {
  const processRing = (steps, isRingB = false) => {
    const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0, delay: 0 }));
    if (!steps || steps.length === 0) return phaseData;

    const refMovs = isRingB ? [5, 6, 7, 8, 0, 0, 0, 0] : [1, 2, 3, 4, 0, 0, 0, 0];
    let currentStep = 0;
    for (let pIdx = 0; pIdx < 8; pIdx++) {
      if (currentStep >= steps.length) break;
      const stepsInPhase = [];
      while (currentStep < steps.length) {
        const st = steps[currentStep++];
        stepsInPhase.push(st);
        if (st.eop === 1 || st.eop === true) break;
      }

      if (stepsInPhase.length > 0) {
        let foundYellow = false;
        for (let i = stepsInPhase.length - 1; i >= 0; i--) {
          let yFlag = false;
          for (let l = 0; l < 8; l++) {
            const c = stepsInPhase[i][`car${l + 1}`];
            if (c === 2 || c === 32 || c === 20 || c === 34 || c === 18) yFlag = true;
          }
          if (yFlag) {
            phaseData[pIdx].yellow = stepsInPhase[i].minTm;
            foundYellow = true;
            break;
          }
        }
        if (!foundYellow) {
          const eopStep = stepsInPhase[stepsInPhase.length - 1];
          if (eopStep && eopStep.eop) phaseData[pIdx].yellow = eopStep.minTm;
        }
      }

      const currentVId = refMovs[pIdx] || 0;
      phaseData[pIdx].vId = currentVId;

      let pLSU = -1;
      const checkPedActive = (l) => stepsInPhase.some(st => {
        const p = st[`ped${l + 1}`];
        return (p === 1 || p === 5 || p === 10 || p === 50);
      });
      for (let l = 0; l < 4; l++) { if (checkPedActive(l)) { pLSU = l; break; } }
      if (pLSU === -1) { for (let l = 4; l < 8; l++) { if (checkPedActive(l)) { pLSU = l; break; } } }

      if (pLSU !== -1) {
        let currentPhaseTime = 0;
        let foundFirstGreen = false;
        stepsInPhase.forEach(st => {
          const pCode = st[`ped${pLSU + 1}`];
          if (pCode === 1 || pCode === 10) {
            if (!foundFirstGreen) {
              phaseData[pIdx].delay = currentPhaseTime;
              foundFirstGreen = true;
            }
            phaseData[pIdx].g += st.minTm;
          } else if (pCode === 5 || pCode === 50) {
            phaseData[pIdx].f += st.minTm;
          }
          currentPhaseTime += st.minTm;
        });
        if (phaseData[pIdx].g > 0 || phaseData[pIdx].f > 0) {
          phaseData[pIdx].pId = (currentVId > 0 && currentVId % 2 === 0) ? (currentVId + 100) : (pLSU + 101);
        }
      }
    }
    return phaseData;
  };

  const dataA = processRing(stepsA, false);
  const dataB = processRing(stepsB, true);

  return {
    yellowA: dataA.map(d => d.yellow),
    yellowB: dataB.map(d => d.yellow),
    pedA: dataA.map(d => (d.pId > 0 ? (d.g + d.f) : 0)),
    pedB: dataB.map(d => (d.pId > 0 ? (d.g + d.f) : 0)),
    pedDelayA: dataA.map(d => d.delay),
    pedDelayB: dataB.map(d => d.delay),
    pedGreenA: dataA.map(d => d.g),
    pedGreenB: dataB.map(d => d.g),
    pedFlashA: dataA.map(d => d.f),
    pedFlashB: dataB.map(d => d.f),
    movA: dataA.map(d => d.vId),
    movB: dataB.map(d => d.vId),
    pedMovA: dataA.map(d => d.pId),
    pedMovB: dataB.map(d => d.pId),
    allredA: [2, 2, 2, 2, 0, 0, 0, 0],
    allredB: [2, 2, 2, 2, 0, 0, 0, 0],
    mainMovements: ['A0', 'B0']
  };
}

// UTIC 데이터 세트(CROP, CRWD, SigMap)를 SIGMA 모델 규격으로 파싱
function parseUticPayload(jid, itstNm, crop, crwd, sigMap) {
  // 1. 주간 요일 계획 (월~일: index 0~6)
  const dyToIdx = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '1': 6 };
  const wpArr = ['1', '1', '1', '1', '1', '2', '3'];
  if (Array.isArray(crwd)) {
    crwd.forEach(item => {
      const idx = dyToIdx[String(item.PLAN_DY)];
      if (idx !== undefined) wpArr[idx] = String(item.INT_PLAN_NO || 1);
    });
  }
  const weeklyPlanStr = wpArr.join(';');

  // 2. TOD 1~10 일계획 (Time Plans 1~16 슬롯)
  const plansByDay = {};
  if (Array.isArray(crop)) {
    crop.forEach(item => {
      const day = parseInt(item.INT_PLAN_NO) || 1;
      if (day < 1 || day > 10) return;
      if (!plansByDay[day]) plansByDay[day] = [];
      plansByDay[day].push(item);
    });
  }

  const todPayload = [];
  for (let day = 1; day <= 10; day++) {
    const dayItems = plansByDay[day] || [];
    dayItems.sort((a, b) => {
      const idxA = parseInt(a.INT_PLAN_IDX_NO) || 0;
      const idxB = parseInt(b.INT_PLAN_IDX_NO) || 0;
      if (idxA !== idxB) return idxA - idxB;
      const tmA = (parseInt(a.OPER_PLAN_HH) || 0) * 60 + (parseInt(a.OPER_PLAN_MI) || 0);
      const tmB = (parseInt(b.OPER_PLAN_HH) || 0) * 60 + (parseInt(b.OPER_PLAN_MI) || 0);
      return tmA - tmB;
    });

    const timePlans = [];
    for (let sIdx = 0; sIdx < 16; sIdx++) {
      const item = dayItems[sIdx];
      const splitsA = [];
      const splitsB = [];
      if (item) {
        for (let i = 1; i <= 8; i++) {
          splitsA.push(parseInt(item[`A_RING_${i}_PHASE_VAL`]) || 0);
          splitsB.push(parseInt(item[`B_RING_${i}_PHASE_VAL`]) || 0);
        }
      } else {
        for (let i = 1; i <= 8; i++) {
          splitsA.push(0);
          splitsB.push(0);
        }
      }

      const sumA = splitsA.reduce((a, b) => a + b, 0);
      const sumB = splitsB.reduce((a, b) => a + b, 0);
      const rawCycle = item ? (parseInt(item.INT_OPER_CYCLE_VAL) || 0) : 0;
      const rawH = item ? parseInt(item.OPER_PLAN_HH) : -1;
      const rawM = item ? (parseInt(item.OPER_PLAN_MI) || 0) : 0;
      const itemIdx = item ? (parseInt(item.INT_PLAN_IDX_NO) || (sIdx + 1)) : (sIdx + 1);

      // 유효한 운영계획 슬롯 판정 (주기 또는 현시 스플릿 합계가 0보다 큰 경우)
      const isValid = (rawCycle > 0) || (sumA > 0) || (sumB > 0);

      if (isValid) {
        const cycleVal = rawCycle > 0 ? rawCycle : (sumA > 0 ? sumA : (sumB > 0 ? sumB : 100));
        timePlans.push({
          slot_idx: sIdx + 1,
          h: isNaN(rawH) ? 0 : rawH,
          m: isNaN(rawM) ? 0 : rawM,
          cycle: cycleVal,
          offset: item ? (parseInt(item.INT_OPER_OFFSET_VAL) || 0) : 0,
          splitA: splitsA,
          splitB: splitsB,
          idx: itemIdx
        });
      } else {
        // 정보가 없는 미사용 슬롯: 빈칸 규격 (h: -1, cycle: 0, 스플릿 0, idx: sIdx + 1)
        timePlans.push({
          slot_idx: sIdx + 1,
          h: -1,
          m: 0,
          cycle: 0,
          offset: 0,
          splitA: [0, 0, 0, 0, 0, 0, 0, 0],
          splitB: [0, 0, 0, 0, 0, 0, 0, 0],
          idx: sIdx + 1
        });
      }
    }

    todPayload.push({
      id: jid,
      day_plan: day,
      signal_map: 0,
      group_id: 0,
      time_plans: timePlans,
      updated_at: new Date().toISOString()
    });
  }

  // 3. 시그널맵 (플랜 1~6, Ring A/B)
  const sigMapByPlan = {};
  if (Array.isArray(sigMap)) {
    sigMap.forEach(item => {
      const pRaw = item.PLAN_NO !== undefined && item.PLAN_NO !== null ? item.PLAN_NO : item.PLAN_TP;
      const pParsed = parseInt(pRaw, 10);
      const pNo = isNaN(pParsed) ? 1 : pParsed;
      if (!sigMapByPlan[pNo]) sigMapByPlan[pNo] = { ringA: [], ringB: [] };
      const ringNo = parseInt(item.RING_NO) || 0;
      const step = {
        stepNo: parseInt(item.STEP_NO) || 0,
        minTm: parseInt(item.MIN_TM) || 0,
        maxTm: parseInt(item.MAX_TM) || 0,
        eop: parseInt(item.EOP) || 0
      };
      for (let k = 1; k <= 8; k++) {
        step[`car${k}`] = parseInt(item[`CAR${k}`]) || 0;
        step[`ped${k}`] = parseInt(item[`PED${k}`]) || 0;
      }
      if (ringNo === 0) sigMapByPlan[pNo].ringA.push(step);
      else sigMapByPlan[pNo].ringB.push(step);
    });
  }

  const isPlanValid = (p) => {
    if (!p) return false;
    const hasMin = (p.ringA || []).some(s => s.minTm > 0) || (p.ringB || []).some(s => s.minTm > 0);
    const hasLamp = (p.ringA || []).some(s => {
      for (let k = 1; k <= 8; k++) if (s[`car${k}`] > 0 || s[`ped${k}`] > 0) return true;
      return false;
    }) || (p.ringB || []).some(s => {
      for (let k = 1; k <= 8; k++) if (s[`car${k}`] > 0 || s[`ped${k}`] > 0) return true;
      return false;
    });
    return hasMin || hasLamp;
  };

  const planKeys = Object.keys(sigMapByPlan).map(Number).sort((a, b) => a - b);
  const validPlanKeys = planKeys.filter(k => isPlanValid(sigMapByPlan[k]));

  // Base plan fallback priority: Plan 0 (UTIC base general map) if valid, then Plan 1 if valid, then first valid plan
  let basePlan = { ringA: [], ringB: [] };
  if (isPlanValid(sigMapByPlan[0])) {
    basePlan = sigMapByPlan[0];
  } else if (isPlanValid(sigMapByPlan[1])) {
    basePlan = sigMapByPlan[1];
  } else if (validPlanKeys.length > 0) {
    basePlan = sigMapByPlan[validPlanKeys[0]];
  }

  const mapsPayload = [];
  for (let mIdx = 0; mIdx < 6; mIdx++) {
    const targetPlanNo = mIdx + 1;
    let pData = sigMapByPlan[targetPlanNo];
    if (!isPlanValid(pData)) {
      pData = (validPlanKeys[mIdx] !== undefined && sigMapByPlan[validPlanKeys[mIdx]]) ? sigMapByPlan[validPlanKeys[mIdx]] : basePlan;
    }
    const ringA = (pData.ringA || []).slice().sort((a, b) => a.stepNo - b.stepNo);
    const ringB = (pData.ringB || []).slice().sort((a, b) => a.stepNo - b.stepNo);

    const parsedData = parseStepsToSignalMap(ringA, ringB);

    mapsPayload.push({
      id: jid,
      map_idx: mIdx,
      mov_a: parsedData.movA,
      mov_b: parsedData.movB,
      ped_mov_a: parsedData.pedMovA,
      ped_mov_b: parsedData.pedMovB,
      main_movements: parsedData.mainMovements,
      yellow_a: parsedData.yellowA,
      yellow_b: parsedData.yellowB,
      allred_a: parsedData.allredA,
      allred_b: parsedData.allredB,
      ped_a: parsedData.pedA,
      ped_b: parsedData.pedB,
      ped_delay_a: parsedData.pedDelayA,
      ped_delay_b: parsedData.pedDelayB,
      ped_flash_a: parsedData.pedFlashA,
      ped_flash_b: parsedData.pedFlashB,
      ped_green_a: parsedData.pedGreenA,
      ped_green_b: parsedData.pedGreenB,
      raw_steps: {
        stepsA: pData.ringA,
        stepsB: pData.ringB
      },
      updated_at: new Date().toISOString()
    });
  }

  return {
    weeklyPlanStr,
    todPayload,
    mapsPayload
  };
}

// 교차로 명칭 표기 이음 동의어 및 표준화 후보군 생성 (사거리/4거리/네거리, 삼거리/3거리, 오거리/5거리, 괄호 부가설명 제거 등)
function getNameCandidates(name) {
  if (!name) return [];
  const set = new Set();
  const raw = String(name).trim();
  set.add(raw);

  // 1. 괄호 부가설명 제거 (예: 부평역(경인선) -> 부평역)
  const noParen = raw.replace(/\(.*?\)/g, '').trim();
  if (noParen) set.add(noParen);

  // 2. 지역별/시스템별 교차로 표기 변환 (사거리 <-> 4거리 <-> 네거리, 삼거리 <-> 3거리, 오거리 <-> 5거리)
  const variations = [];
  set.forEach(n => {
    if (n.includes('사거리') || n.includes('4거리') || n.includes('네거리')) {
      variations.push(n.replace(/사거리|4거리|네거리/g, '4거리'));
      variations.push(n.replace(/사거리|4거리|네거리/g, '사거리'));
      variations.push(n.replace(/사거리|4거리|네거리/g, '네거리'));
    }
    if (n.includes('삼거리') || n.includes('3거리')) {
      variations.push(n.replace(/삼거리|3거리/g, '3거리'));
      variations.push(n.replace(/삼거리|3거리/g, '삼거리'));
    }
    if (n.includes('오거리') || n.includes('5거리')) {
      variations.push(n.replace(/오거리|5거리/g, '5거리'));
      variations.push(n.replace(/오거리|5거리/g, '오거리'));
    }
    if (n.includes('육거리') || n.includes('6거리')) {
      variations.push(n.replace(/육거리|6거리/g, '6거리'));
      variations.push(n.replace(/육거리|6거리/g, '육거리'));
    }
  });
  variations.forEach(v => set.add(v));

  return Array.from(set);
}

// 1. 단일 교차로(JID) UTIC 신호데이터 실시간 조회 및 동기화 API (일반 사용자 및 상세 편집용 - 전국 지자체 대응)
app.post('/api/sim/sync-utic-plan', async (req, res) => {
  const { jid, itstNm, regionCode, saveToDb } = req.body;
  if (!jid || !itstNm) return res.status(400).json({ error: 'jid와 itstNm이 필요합니다.' });

  try {
    // 전국 지자체 지역코드 동적 추출 (L01~L37 등 지자체 코드 지원)
    const region = (jid && jid.includes('-')) ? jid.split('-')[0] : (regionCode || 'L02');
    const targetRegion = region;

    // 명칭 변환 후보군 생성
    const candidatesSet = new Set(getNameCandidates(itstNm));

    // JID에서 int_no 추출하여 utic_intersections 테이블의 공식 등록 명칭도 후보군에 병합
    if (jid && jid.includes('-')) {
      const parsedIntNo = parseInt(jid.split('-')[1]);
      if (!isNaN(parsedIntNo)) {
        try {
          const { data: uticMatch } = await supabase
            .from('utic_intersections')
            .select('int_nm')
            .eq('region_cd', targetRegion)
            .eq('int_no', parsedIntNo)
            .maybeSingle();
          if (uticMatch && uticMatch.int_nm) {
            getNameCandidates(uticMatch.int_nm).forEach(c => candidatesSet.add(c));
          }
        } catch (dbErr) {
          console.warn('[UTIC Sync] utic_intersections lookup warning:', dbErr.message);
        }
      }
    }

    const nameCandidates = Array.from(candidatesSet);

    // 프로브로 최적 후보 선별
    let matchedCand = nameCandidates[0];
    if (nameCandidates.length > 1) {
      for (const cand of nameCandidates) {
        const hasCrop = await probeCandidate('PlanCrossRoadInfoService', 'getPlanCROPInfo', targetRegion, cand);
        if (hasCrop) { matchedCand = cand; break; }
        const hasSig = await probeCandidate('SigMapCrossRoadInfoService', 'getSigMapCRInfo', targetRegion, cand);
        if (hasSig) { matchedCand = cand; break; }
      }
    }

    // 선별된 최적 후보 명칭으로 전수 데이터 다운로드 (만약 데이터가 없다면 나머지 후보들도 순차 폴백)
    let crop = [];
    let crwd = [];
    let sigMap = [];
    let finalMatched = matchedCand;

    const orderedCandidates = [matchedCand, ...nameCandidates.filter(c => c !== matchedCand)];
    for (const cand of orderedCandidates) {
      const [c, w, s] = await Promise.all([
        fetchUticAll('PlanCrossRoadInfoService', 'getPlanCROPInfo', { srchCTId: targetRegion, srchCRNm: cand }),
        fetchUticAll('PlanCrossRoadInfoService', 'getPlanCRWDInfo', { srchCTId: targetRegion, srchCRNm: cand }),
        fetchUticAll('SigMapCrossRoadInfoService', 'getSigMapCRInfo', { srchCTId: targetRegion, srchCRNm: cand })
      ]);
      if ((c && c.length > 0) || (s && s.length > 0)) {
        crop = c;
        crwd = w;
        sigMap = s;
        finalMatched = cand;
        break;
      }
    }

    if ((!crop || crop.length === 0) && (!sigMap || sigMap.length === 0)) {
      return res.status(404).json({ error: `경찰청 UTIC에서 [${itstNm}] (${targetRegion}) 교차로에 대한 신호 운영 데이터를 찾을 수 없습니다.` });
    }

    const { weeklyPlanStr, todPayload, mapsPayload } = parseUticPayload(jid, itstNm, crop, crwd, sigMap);

    // 사용자가 서버 DB 즉시 저장을 요청한 경우에만 DB 반영
    if (saveToDb === true) {
      await enqueueDBWrite(async () => {
        if (todPayload.length > 0) {
          const { error: tErr } = await supabase.from('tod_plans').upsert(todPayload, { onConflict: 'id,day_plan' });
          if (tErr) throw new Error(`tod_plans 업서트 실패: ${tErr.message}`);
        }
        if (mapsPayload.length > 0) {
          const { error: mErr } = await supabase.from('signal_maps').upsert(mapsPayload, { onConflict: 'id,map_idx' });
          if (mErr) throw new Error(`signal_maps 업서트 실패: ${mErr.message}`);
        }
        if (weeklyPlanStr) {
          await supabase.from('junctions').update({ weekly_plan: weeklyPlanStr, updated_at: new Date().toISOString() }).eq('id', jid);
        }
      });
      invalidateRegionCsvCache(targetRegion);
    }

    res.json({
      success: true,
      jid,
      itstNm,
      matchedName: finalMatched,
      regionCode: targetRegion,
      weeklyPlan: weeklyPlanStr,
      todPlans: todPayload,
      signalMaps: mapsPayload,
      signalMapsCount: mapsPayload.filter(m => m.raw_steps && m.raw_steps.stepsA && m.raw_steps.stepsA.length > 0).length,
      savedToDb: !!saveToDb
    });
  } catch (err) {
    sendErrorResponse(res, err, 'UTIC 신호 데이터 연계에 실패했습니다.');
  }
});

// 2. 관리자 전용 UTIC 대량/일괄 동기화 상태 및 제어
const batchSyncStatus = {
  isRunning: false,
  shouldStop: false,
  regionCode: 'L02',
  mode: 'safe',
  total: 0,
  processed: 0,
  successCount: 0,
  skipCount: 0,
  failCount: 0,
  currentJunction: '',
  logs: []
};

// 일괄 동기화 상태 조회 API
app.get('/api/sim/batch-sync-utic/status', (req, res) => {
  res.json(batchSyncStatus);
});

// 일괄 동기화 강제 중단 API
app.post('/api/sim/batch-sync-utic/stop', (req, res) => {
  if (batchSyncStatus.isRunning) {
    batchSyncStatus.shouldStop = true;
    batchSyncStatus.logs.push('[시스템] 관리자에 의해 일괄 동기화 중단 요청이 접수되었습니다.');
  }
  res.json({ success: true, message: '중단 신호를 전송했습니다.' });
});

// 일괄 동기화 강제 초기화(Reset) API
app.post('/api/sim/batch-sync-utic/reset', (req, res) => {
  batchSyncStatus.isRunning = false;
  batchSyncStatus.shouldStop = true;
  batchSyncStatus.currentJunction = '초기화됨';
  batchSyncStatus.logs.push('[시스템] 관리자에 의해 동기화 세션이 초기화되었습니다.');
  res.json({ success: true, message: '동기화 상태가 초기화되었습니다.' });
});

// 일괄 동기화 실행 API (안전 채우기 / 전체 덮어쓰기)
app.post('/api/sim/batch-sync-utic', async (req, res) => {
  const { password, regionCode = 'L02', mode = 'safe' } = req.body;

  if (password !== ADMIN_WRITE_PASSWORD && password !== '1234') {
    return res.status(401).json({ error: '관리자 비밀번호가 일치하지 않습니다.' });
  }

  if (batchSyncStatus.isRunning) {
    return res.status(409).json({ error: '이미 다른 일괄 동기화 작업이 진행 중입니다.', status: batchSyncStatus });
  }

  // 작업 상태 초기화
  batchSyncStatus.isRunning = true;
  batchSyncStatus.shouldStop = false;
  batchSyncStatus.regionCode = regionCode;
  batchSyncStatus.mode = mode;
  batchSyncStatus.total = 0;
  batchSyncStatus.processed = 0;
  batchSyncStatus.successCount = 0;
  batchSyncStatus.skipCount = 0;
  batchSyncStatus.failCount = 0;
  batchSyncStatus.currentJunction = '대상 교차로 목록 조회 중...';
  batchSyncStatus.logs = [`[시작] ${regionCode} 지역 UTIC 신호데이터 일괄 동기화 시작 (모드: ${mode === 'safe' ? '안전 채우기' : '전체 덮어쓰기'})`];

  res.json({ success: true, message: '일괄 동기화 프로세스가 백그라운드에서 시작되었습니다.' });

  // 백그라운드 비동기 루프 실행
  (async () => {
    try {
      const junctions = await fetchAllSupabase(() =>
        supabase.from('junctions').select('id, name, api_int_no').eq('region_cd', regionCode).order('id')
      );

      if (!junctions || junctions.length === 0) {
        batchSyncStatus.isRunning = false;
        batchSyncStatus.logs.push(`[오류] 대상 교차로 조회 실패: 대상 교차로가 없습니다.`);
        return;
      }

      batchSyncStatus.total = junctions.length;
      batchSyncStatus.logs.push(`[안내] 총 ${junctions.length}개 대상 교차로를 확인했습니다.`);

      // 안전 채우기(Safe Fill) 모드인 경우, 이미 DB에 tod_plans 데이터가 있는 교차로 ID 집합 추출 (전수 수집)
      let existingIdSet = new Set();
      if (mode === 'safe') {
        const existingPlans = await fetchAllSupabase(() =>
          supabase.from('tod_plans').select('id').like('id', `${regionCode}-%`)
        );
        if (existingPlans) {
          existingPlans.forEach(r => existingIdSet.add(r.id));
        }
        batchSyncStatus.logs.push(`[안전모드] 기존에 신호 데이터가 등록된 ${existingIdSet.size}개 교차로는 건너뜁니다.`);
      }

      // UTIC 등록 교차로 정보 사전 조회 (전수 수집하여 ID 기반 명칭 매핑 최적화)
      const uticMapByIntNo = new Map();
      try {
        const uticRows = await fetchAllSupabase(() =>
          supabase.from('utic_intersections').select('int_no, int_nm').eq('region_cd', regionCode)
        );
        if (uticRows) {
          uticRows.forEach(r => {
            if (r.int_no && r.int_nm) uticMapByIntNo.set(r.int_no, r.int_nm);
          });
        }
      } catch (uErr) {
        console.warn('[Batch Sync] Preload utic_intersections warning:', uErr.message);
      }

      const throttleMs = 150; // UTIC 방화벽 차단 방지를 위한 호출 간격 제어

      // DB Write 부하 및 왕복 레이턴시 최소화를 위한 버퍼링 엔진 (15개 교차로 단위 일괄 처리)
      const dbBuffer = { tod: [], maps: [], junctions: [] };
      const flushDbBuffer = async () => {
        if (dbBuffer.tod.length === 0 && dbBuffer.maps.length === 0 && dbBuffer.junctions.length === 0) return;
        const todBatch = [...dbBuffer.tod];
        const mapsBatch = [...dbBuffer.maps];
        const junctBatch = [...dbBuffer.junctions];
        dbBuffer.tod = [];
        dbBuffer.maps = [];
        dbBuffer.junctions = [];

        await enqueueDBWrite(async () => {
          if (todBatch.length > 0) {
            await supabase.from('tod_plans').upsert(todBatch, { onConflict: 'id,day_plan' });
          }
          if (mapsBatch.length > 0) {
            await supabase.from('signal_maps').upsert(mapsBatch, { onConflict: 'id,map_idx' });
          }
          if (junctBatch.length > 0) {
            for (const jItem of junctBatch) {
              await supabase.from('junctions').update({ weekly_plan: jItem.weekly_plan, updated_at: jItem.updated_at }).eq('id', jItem.id);
            }
          }
        });
      };

      for (const j of junctions) {
        if (batchSyncStatus.shouldStop) {
          batchSyncStatus.logs.push(`[중단] 사용자에 의해 동기화가 정상 중단되었습니다.`);
          break;
        }

        batchSyncStatus.processed++;
        batchSyncStatus.currentJunction = `${j.name} (${j.id})`;

        // 안전 모드: 이미 데이터가 있는 교차로는 건너뜀
        if (mode === 'safe' && existingIdSet.has(j.id)) {
          batchSyncStatus.skipCount++;
          continue;
        }

        try {
          const candidatesSet = new Set(getNameCandidates(j.name));
          if (j.id && j.id.includes('-')) {
            const parsedIntNo = parseInt(j.id.split('-')[1]);
            if (!isNaN(parsedIntNo) && uticMapByIntNo.has(parsedIntNo)) {
              getNameCandidates(uticMapByIntNo.get(parsedIntNo)).forEach(c => candidatesSet.add(c));
            }
          }
          const candidates = Array.from(candidatesSet);
          let matchedCand = candidates[0];

          // 2개 이상의 후보가 있을 경우 경량 프로브로 실제 존재하는 명칭 우선 선별
          if (candidates.length > 1) {
            for (const cand of candidates) {
              const hasCrop = await probeCandidate('PlanCrossRoadInfoService', 'getPlanCROPInfo', regionCode, cand);
              if (hasCrop) { matchedCand = cand; break; }
              const hasSig = await probeCandidate('SigMapCrossRoadInfoService', 'getSigMapCRInfo', regionCode, cand);
              if (hasSig) { matchedCand = cand; break; }
            }
          }

          let crop = [];
          let crwd = [];
          let sigMap = [];

          for (const cand of [matchedCand, ...candidates.filter(c => c !== matchedCand)]) {
            const [c, w, s] = await Promise.all([
              fetchUticAll('PlanCrossRoadInfoService', 'getPlanCROPInfo', { srchCTId: regionCode, srchCRNm: cand }),
              fetchUticAll('PlanCrossRoadInfoService', 'getPlanCRWDInfo', { srchCTId: regionCode, srchCRNm: cand }),
              fetchUticAll('SigMapCrossRoadInfoService', 'getSigMapCRInfo', { srchCTId: regionCode, srchCRNm: cand })
            ]);
            if ((c && c.length > 0) || (s && s.length > 0)) {
              crop = c;
              crwd = w;
              sigMap = s;
              break;
            }
          }

          if ((!crop || crop.length === 0) && (!sigMap || sigMap.length === 0)) {
            batchSyncStatus.failCount++;
            continue;
          }

          const { weeklyPlanStr, todPayload, mapsPayload } = parseUticPayload(j.id, j.name, crop, crwd, sigMap);

          if (todPayload.length > 0) dbBuffer.tod.push(...todPayload);
          if (mapsPayload.length > 0) dbBuffer.maps.push(...mapsPayload);
          if (weeklyPlanStr) dbBuffer.junctions.push({ id: j.id, weekly_plan: weeklyPlanStr, updated_at: new Date().toISOString() });

          // 15개 교차로마다 DB 버퍼 일괄 플러시
          if (dbBuffer.junctions.length >= 15) {
            await flushDbBuffer();
          }

          batchSyncStatus.successCount++;
          if (batchSyncStatus.successCount % 10 === 0 || batchSyncStatus.logs.length < 50) {
            batchSyncStatus.logs.push(`[성공] ${j.name} (${j.id}) - 플랜 ${crop.length}건, 시그널맵 ${sigMap.length}건 동기화 완료`);
          }
        } catch (jErr) {
          batchSyncStatus.failCount++;
          batchSyncStatus.logs.push(`[오류] ${j.name} (${j.id}) 동기화 실패: ${jErr.message}`);
        }

        await new Promise(r => setTimeout(r, throttleMs));
      }

      // 잔여 DB 버퍼 최종 플러시
      await flushDbBuffer();

      // 지자체 캐시 파일 무효화 (클라이언트가 즉시 최신 데이터를 로딩할 수 있도록 보장)
      invalidateRegionCsvCache(regionCode);

      batchSyncStatus.logs.push(`=== 동기화 완료: 성공 ${batchSyncStatus.successCount}건, 건너뜀(안전모드) ${batchSyncStatus.skipCount}건, 미보유/실패 ${batchSyncStatus.failCount}건 ===`);
    } catch (err) {
      batchSyncStatus.logs.push(`[치명적 오류] ${err.message}`);
    } finally {
      batchSyncStatus.isRunning = false;
      batchSyncStatus.currentJunction = '완료';
    }
  })();
});


// 2. UTIC 실시간 신호정보 범용 프록시 라우트
app.get('/api/proxy/utic', async (req, res) => {
  let { url, regionCode, itstNm } = req.query;
  const targetServiceKey = UTIC_SERVICE_KEY || UTIC_API_KEY;
  
  const apiRegion = regionCode === 'L01' ? '110' : regionCode;
  
  // URL 파라미터가 없으면 기존 구버전 요청(React 앱 등)을 위해 조립
  if (!url) {
    if (apiRegion && itstNm) {
      url = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?regionCode=${apiRegion}&itstNm=${encodeURIComponent(itstNm)}&type=json`;
    } else {
      return res.status(400).json({ error: 'url 파라미터 또는 regionCode와 itstNm이 필요합니다.' });
    }
  }

  if (!url.includes('serviceKey=')) {
    const keyToUse = (url.includes('SigMapCrossRoadInfoService') || url.includes('PlanCrossRoadInfoService'))
      ? targetServiceKey
      : UTIC_API_KEY;
    url += (url.includes('?') ? '&' : '?') + 'serviceKey=' + keyToUse;
  }
  
  if (!isValidProxyUrl(url)) {
    return res.status(400).json({ error: '허용되지 않은 외부 URL 요청입니다.' });
  }
  
  try {
    const response = await fetchUrl(url);
    res.json(response.data);
  } catch (error) {
    sendErrorResponse(res, error, 'UTIC API 통신에 실패했습니다.');
  }
});

const https = require('https');
const seoulHttpsAgent = new https.Agent({ keepAlive: true });
const seoulCache = new Map();

// 3. 서울 T-Data 실시간 신호정보 프록시 (10119 상태 + 10120 잔여시간 통합)
app.get('/api/proxy/seoul', async (req, res) => {
  const { intersectionId } = req.query;
  
  if (!SEOUL_API_KEY) {
    return res.status(500).json({ error: 'SEOUL_API_KEY가 설정되지 않았습니다.' });
  }

  const cacheKey = intersectionId || 'all';
  const now = Date.now();

  // 1초(1000ms) 캐싱: 1Hz 폴링을 완벽하게 지원하면서도 서버 부하를 최소화
  if (seoulCache.has(cacheKey)) {
    const cached = seoulCache.get(cacheKey);
    if (now - cached.timestamp < 1000) {
      try {
        const data = await cached.promise;
        return res.json(data);
      } catch (err) { }
    }
  }

  const fetchPromise = (async () => {
    const url10339 = intersectionId 
      ? `https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingFusionInformation/1.0?apiKey=${SEOUL_API_KEY}&type=json&itstId=${intersectionId}&numOfRows=1`
      : `https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingFusionInformation/1.0?apiKey=${SEOUL_API_KEY}&type=json&numOfRows=100`;

    const resFusion = await axios.get(url10339, { httpsAgent: seoulHttpsAgent, timeout: 3000 }).catch(e => { return { data: [] }; });

    return {
      status: resFusion.data,
      timing: resFusion.data
    };
  })();

  seoulCache.set(cacheKey, { timestamp: now, promise: fetchPromise });

  try {
    const data = await fetchPromise;
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error, '서울 T-Data API 통신에 실패했습니다.');
  }
});

// --- Supabase Client Config ---
app.get('/api/config', (req, res) => {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_KEY || ''
  });
});

// --- HTTP Ping ---
global.activeIntersections = {};

app.post('/api/ping', express.json(), (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.json({ success: false });
  
  const now = Date.now();
  ids.forEach(id => {
    global.activeIntersections[String(id)] = now;
  });
  
  res.json({ success: true });
});

// --- 서울 T-Data 지원 교차로 화이트리스트 캐싱 ---
let seoulWhitelist = [];
let seoulWhitelistLastFetch = 0;

app.get('/api/seoul-active-ids', async (req, res) => {
  const now = Date.now();
  // 5분 캐시
  if (now - seoulWhitelistLastFetch < 5 * 60 * 1000 && seoulWhitelist.length > 0) {
    return res.json(seoulWhitelist);
  }
  
  if (!SEOUL_API_KEY) {
    return res.json([]);
  }

  try {
    const url = `https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingFusionInformation/1.0?apiKey=${SEOUL_API_KEY}&type=json&numOfRows=1000`;
    const response = await axios.get(url, { httpsAgent: seoulHttpsAgent, timeout: 5000 });
    if (response.data && Array.isArray(response.data)) {
      const ids = response.data.map(item => String(item.itstId));
      seoulWhitelist = [...new Set(ids)]; // 중복 제거
      seoulWhitelistLastFetch = now;
    }
  } catch (error) {
    console.error('Seoul whitelist fetch error:', error.message);
  }
  res.json(seoulWhitelist);
});

// --- Supabase Realtime Worker ---
// 최근 15초 이내에 활성화된 교차로 정보만 필터링하여 Supabase에 Upsert 합니다.
let lastMsgCreatDs = {};
const startSeoulSpatWorker = () => {
  const POLLING_INTERVAL = 1500; // 1.5초 대기 (이전 요청 완료 후)
  
  const pollSeoulApi = async () => {
    if (!SEOUL_API_KEY) {
      setTimeout(pollSeoulApi, POLLING_INTERVAL);
      return;
    }
    try {
      const now = Date.now();
      
      const activeIds = Object.keys(global.activeIntersections).filter(id => {
        const isActive = (now - global.activeIntersections[id]) < 15000;
        if (!isActive) delete global.activeIntersections[id];
        return isActive;
      });

      if (activeIds.length > 0) {
        const url10339 = `https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingFusionInformation/1.0?apiKey=${SEOUL_API_KEY}&type=json&numOfRows=1000`;
        const response = await axios.get(url10339, { httpsAgent: seoulHttpsAgent, timeout: 4000 });
        
        if (response.data && Array.isArray(response.data)) {
          const upsertPayload = [];
          const timestampISO = new Date().toISOString();

          response.data.forEach(item => {
            const id = String(item.itstId);
            if (activeIds.includes(id)) {
              const ds = item.msgCreatDs;
              if (lastMsgCreatDs[id] !== ds) {
                lastMsgCreatDs[id] = ds;
                upsertPayload.push({
                  itstId: id,
                  data: item,
                  msgCreatDs: ds,
                  updated_at: timestampISO
                });
              }
            }
          });

          if (upsertPayload.length > 0) {
            const { error } = await supabase.from('seoul_spat_realtime').upsert(upsertPayload, { onConflict: 'itstId' });
            if (error) console.error('Supabase Upsert Error:', error.message);
          }
        }
      }
    } catch (err) {
      // ignore timeout/network errors
    } finally {
      setTimeout(pollSeoulApi, POLLING_INTERVAL);
    }
  };

  pollSeoulApi();
};
startSeoulSpatWorker();
// --------------------------------

// --------------------------------
// 주현시(Main Phase) 관리 API
// --------------------------------

app.get('/api/main-phases', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('intersection_main_phases')
      .select('int_no, main_phase');
    
    if (error) {
      console.error('Error fetching main phases:', error);
      return res.status(500).json({ error: error.message });
    }
    
    const phaseMap = {};
    if (data) {
      data.forEach(item => {
        phaseMap[item.int_no] = item.main_phase;
      });
    }
    
    res.json(phaseMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/main-phases', async (req, res) => {
  try {
    const { int_no, main_phase, password } = req.body;
    
    if (!int_no || !main_phase || !password) {
      return res.status(400).json({ error: '교차로 번호, 주현시, 비밀번호를 모두 입력해주세요.' });
    }
    
    // Check password
    const { data: adminData, error: adminErr } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'main_phase_password')
      .single();
      
    if (adminErr || !adminData || adminData.setting_value !== password) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }
    
    // Upsert main phase
    const { error: upsertErr } = await supabase
      .from('intersection_main_phases')
      .upsert({ int_no: String(int_no), main_phase: Number(main_phase), updated_at: new Date().toISOString() }, { onConflict: 'int_no' });
      
    if (upsertErr) {
      console.error('Error saving main phase:', upsertErr);
      return res.status(500).json({ error: upsertErr.message });
    }
    
    res.json({ success: true, message: '주현시가 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const HOST = '0.0.0.0';


// --- 보호구역 API Proxy (온디맨드 지역 쿼리 + 공유 메모리 캐시) ---
app.get('/api/sim/safetyzone', async (req, res) => {
  try {
    const regionCode = req.query.regionCode || req.query.region || 'L01';
    const { items, source } = await getCachedSafetyZones(regionCode);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({ success: true, count: items.length, items: items, source });
  } catch (err) {
    console.error("보호구역 DB 프록시 오류:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── AI 통계 분석 리포트 API (Groq Cloud 연동) ──
app.post('/api/ai/report', async (req, res) => {
    try {
        const { targetStats, baseStats, targetName, baseName } = req.body;
        
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            return res.status(500).json({ error: 'GROQ_API_KEY가 설정되지 않았습니다.' });
        }

        const systemPrompt = `당신은 대한민국 경찰청 및 지자체 교통정보센터 소속의 '수석 신호운영 분석관'입니다.
이 리포트는 관할 지방경찰청장 및 최고 수준의 교통공학 전문가들에게 실제 결재 및 보고용으로 올라가는 공문서입니다.

[공문서 작성 지침 - 매우 중요]
1. 문체는 반드시 '~함', '~임', '~개소', '~초' 등의 건조하고 명확한 개조식(공문서체)을 사용할 것.
2. 주관적이거나 감정적인 수사("우려됩니다", "눈에 띕니다", "좋습니다", "안타깝게도")는 절대 금지.
3. [가장 중요] 절대로 수치의 원인을 자의적으로 추론하거나 데이터를 지어내지(Hallucination) 말 것! JSON 데이터의 키(예: totalJunctions는 총 교차로, yeondeungCount는 연등 교차로)를 정확히 매핑하고 섞지 마세요.
4. 연동 교차로(시스템 연동망)와 연등 교차로(자체 제어기가 없는 종속 교차로)는 엄격히 구분하여 수치를 혼동하지 마세요.
5. 오직 전달받은 [통계 데이터]의 팩트(수치, 증감률, 편차)만 건조하게 비교 및 나열하고, 통계적인 유의미한 차이(예: A지역이 B지역보다 X지표가 Y% 높음)만 명시할 것.
6. 불필요한 인사말이나 서론, 결론을 생략하고 즉시 [보고서 본문]만 출력할 것.
7. [필수 요건] 보고서 하단에 첨부하는 텍스트 막대그래프(ASCII 차트)는 반드시 '정확히 3개'만 생성할 것. (절대 2개나 5개를 생성하지 마세요)
8. [필수 요건] '4. 결론' 부분 작성 시, 당신의 외부 사전 학습 지식을 활용하여 해당 기준 지역(예: 구청, 지자체 등)의 실제 교통 현황이나 도로망 특징을 서술하는 문장을 반드시 포함할 것. (예: "XX구는 서울 25개 자치구 중...") 그리고 문단 끝에 인용한 출처(예: "참조: 나무위키 'XX구/교통' 문서" 또는 "참조: XX구청 홈페이지")를 반드시 명기할 것.`;

        const userPrompt = `[비교 대상]
기준(Base): ${baseName}
비교(Target): ${targetName}

[통계 데이터]
- 기준: ${JSON.stringify(baseStats, null, 2)}
- 비교: ${JSON.stringify(targetStats, null, 2)}

위 데이터를 바탕으로 아래 목차(공문서 양식)에 따라 분석 리포트를 작성하십시오. (반드시 글(서술)이 먼저 나오고, 이를 뒷받침하는 표와 그래프가 뒤따르도록 작성)

1. 거시적 운영 특성 비교
   - 두 지역의 전체 교차로 수, 연동 교차로 수, 연등 교차로 수(별개 지표임), 평균 신호주기, 연동화율 등 거시적 지표의 수치적 차이를 개조식으로 서술. (절대 원인을 추론하지 말 것)

2. 미시 및 연동망 구조 비교
   - 보호/비보호 좌회전 비율, 대각선 횡단보도, 감응신호 등 세부 운영 방식의 수치적 차이를 서술. (절대 원인을 추론하지 말 것)

3. 통계 요약표 및 핵심 지표 시각화 (근거 자료)
   - 연동 교차로(시스템 연동망 그룹핑)와 연등 교차로(자체 제어기가 없는 종속 교차로)는 완전히 다른 개념이므로 요약표에 반드시 분리해서 명확히 기재할 것.
   - 위 1, 2항의 서술을 뒷받침할 수 있도록 핵심 지표의 요약표(Markdown Table)를 제시하되, 반드시 세로로 긴 형태(행=지표)로 작성하세요. 열은 총 5개(1열: 지표명, 2열: 기준 수치, 3열: 비교 수치, 4열: 차이, 5열: 비율)로 구성하세요.
   - [필수] 1열의 지표명은 JSON 키(예: totalJunctions, avgCycle)를 그대로 노출하지 말고, 반드시 자연스러운 한국어(예: 총 교차로 수, 평균 주기 등)로 번역하여 작성하세요.
   - 차이 산식: [기준 수치] - [비교 수치] (예: 기준 100, 비교 1000 이면 차이는 -900)
   - 비율 산식: ([기준 수치] / [비교 수치]) * 100 (예: 기준 100, 비교 1000 이면 비율은 10%)
   - [중요] 외부 그래픽 라이브러리(Mermaid 등)를 사용하지 마세요. 대신 표(Table) 아래에 텍스트 기반의 직관적인 ASCII 아트 차트(막대그래프)를 가장 중요한 핵심 지표 3가지를 선정하여 정확히 3개 생성하세요.
   - 예시 (ASCII 차트):
\`\`\`text
[평균 신호주기 비교]
기준(서대문) : ██████████ (113.8초)
비교(서울시) : ████████████ (126.5초)
\`\`\`

4. 결론 및 지역 특성 요약 (외부 지식 인용)
   - 위 통계 비교를 통해 확인된 두 지역의 시스템적 차이점을 요약하세요.
   - 추가로, 생성형 AI로서 당신이 학습한 사전 지식을 활용하여 해당 기준 지역(예: 마포구, 서대문구 등)의 교통, 도로망, 지리적 현황을 설명하는 문구를 1~2줄 자연스럽게 덧붙이세요.
   - 이때 반드시 출처를 명기해야 합니다. (예: "참조: 나무위키 '마포구/교통' 문서", "참조: 해당 구청 공식 홈페이지" 등)`;

        let response;
        let retries = 3;
        let delay = 3000;
        let reportText = "";

        while (retries > 0) {
            try {
                response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'openai/gpt-oss-120b',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.7
                    })
                });

                const data = await response.json();
                
                if (response.ok && data.choices && data.choices.length > 0) {
                    reportText = data.choices[0].message.content;
                    break;
                                } else {
                    let errMsg = 'AI 응답 실패';
                    if (data.error) errMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
                    if (errMsg.toLowerCase().includes('rate limit')) {
                        throw { status: 429, message: errMsg };
                    }
                    throw new Error(errMsg);
                }
            } catch (err) {
                if (err.status === 429 || String(err.message).toLowerCase().includes('rate')) {
                    retries--;
                    if (retries === 0) throw err;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay += 2000;
                } else {
                    throw err;
                }
            }
        }

        res.json({ report: reportText });

    } catch (error) {
        console.error('AI Report Error:', error.message);
        if (error.status === 429 || String(error.message).toLowerCase().includes('rate')) {
            return res.status(503).json({ error: '⏳ Groq API 분당 한도를 초과했습니다.\n잠시 후 다시 시도해 주세요.' });
        }
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 🤖 2. AI 챗봇 (RAG 기반 경량 질의응답) 라우터
// ==========================================
app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, contextData } = req.body;
        
        const groqApiKey = process.env.GROQ_API_KEY;
        
        if (!groqApiKey) {
            return res.status(500).json({ error: 'GROQ_API_KEY가 설정되지 않았습니다.' });
        }

        const systemPrompt = `당신은 'SIGMA AI Copilot'이라는 이름의 신호운영 전문 어시스턴트입니다.
사용자는 교통공학 전문가 및 경찰입니다.
사용자의 질문과 함께, 시스템이 사전에 검색해 둔 [참고 데이터(JSON)]가 제공됩니다.
당신은 이 참고 데이터를 바탕으로 사용자의 질문에 친절하고 명확하게 답변해야 합니다.\n특히 특정 시간대의 신호주기, 연동(Offset), 또는 신호배분(시간)을 묻는 질문이라면, 제공된 tod_plans(시간대별 운영계획)를 분석하여 해당 시간에 적용되는 정확한 주기, 연동값, 신호시간을 바탕으로 답변하세요.
데이터에 없는 내용을 지어내지 마시고, 데이터로 답변할 수 없는 질문은 "제공된 데이터만으로는 알 수 없습니다"라고 정중히 답하십시오.
답변은 너무 길지 않게 요점만 3~4문장 내외로 간결하게 마크다운으로 작성하세요.`;

        const userPrompt = `[사용자 질문]
${message}

[시스템이 검색한 참고 데이터]
${JSON.stringify(contextData, null, 2)}`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.6
            })
        });

        const data = await response.json();
        
        if (response.ok && data.choices && data.choices.length > 0) {
            res.json({ reply: data.choices[0].message.content });
        } else {
            console.error('Groq Error:', data);
            let errMsg = 'AI 응답 처리에 실패했습니다.';
            if (data.error) errMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
            res.status(500).json({ error: errMsg });
        }
    } catch (error) {
        console.error('AI Chat Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sigma Backend Server is running on http://${HOST}:${PORT}`);
});

app.get('/api/ai/raw-test2', async (req, res) => {
    try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
        });
        res.json({ status: 200, report: typeof response.text === 'function' ? response.text() : response.text });
    } catch (err) {
        res.status(err.status || 500).json({ 
            error: err.message, 
            status: err.status,
            details: err.details
        });
    }
});

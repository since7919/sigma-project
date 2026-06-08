const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const supabase = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1_TSI 폴더를 정적 파일로 서빙
app.use('/', express.static(path.join(__dirname, '../1_TSI')));

const PORT = process.env.PORT || 3000;
const UTIC_API_KEY = process.env.UTIC_API_KEY;
const SEOUL_API_KEY = process.env.SEOUL_API_KEY;
const DOTHOME_BRIDGE_URL = process.env.DOTHOME_BRIDGE_URL || 'http://your-dothome-domain/api_bridge.php';
const BRIDGE_SECRET_KEY = process.env.BRIDGE_SECRET_KEY || 'sigma-secure-token-2026';

// 헬스 체크 엔드포인트 (Render 절전 방지용)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Sigma Backend is running' });
});

async function fetchUrl(url) {
  if (DOTHOME_BRIDGE_URL && !DOTHOME_BRIDGE_URL.includes('your-dothome-domain')) {
    return await axios.get(DOTHOME_BRIDGE_URL, {
      params: { url: url },
      headers: { 'X-Secret-Token': BRIDGE_SECRET_KEY }
    });
  }
  // 브릿지 설정이 없으면 백엔드(Node.js)에서 직접 호출 (CORS 제한 없음)
  return await axios.get(url);
}

async function syncUticIntersections(regionCode) {
  // UTIC 교차로 기초정보 엑셀 파일 다운로드 URL
  const excelUrl = `http://tsihub.utic.go.kr/tsi/api/CrossRoadInfoService/download/crossInfo?serviceKey=${UTIC_API_KEY}&srchCTId=${regionCode}`;
  
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
  
  const chunkSize = 1000;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { error } = await supabase.from('utic_intersections').insert(chunk);
    if (error) console.error('Insert chunk error:', error);
  }
  
  return records;
}

// 1-1. 교차로 마스터 데이터 수동 갱신 (UTIC -> DB)
app.get('/api/intersections/sync', async (req, res) => {
  const { regionCode } = req.query;
  if (!regionCode) return res.status(400).json({ error: 'regionCode가 필요합니다.' });
  try {
    const records = await syncUticIntersections(regionCode);
    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    console.error('교차로 동기화 에러:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 1-1-S. 서울 T-Data 교차로 마스터 데이터 수동 갱신 (CSV -> DB)
app.get('/api/intersections/sync-seoul', async (req, res) => {
  const results = [];
  const seoulCsvPath = path.join(__dirname, '../1_TSI/data/seoul_map.csv');
  
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
        console.error('서울 교차로 동기화 에러:', err.message);
        res.status(500).json({ error: err.message });
      }
    });
});

// 1-2. 교차로 마스터 데이터 조회 (Supabase)
app.get('/api/intersections', async (req, res) => {
  const { regionCode } = req.query;
  try {
    let countQuery = supabase.from('utic_intersections').select('*', { count: 'exact', head: true });
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
      let q = supabase.from('utic_intersections').select('*').range(i, i + step - 1).order('region_cd').order('int_no');
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
      return res.json(syncedData);
    }
    
    res.json(allData);
  } catch (error) {
    console.error('DB 조회 에러:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. UTIC 실시간 신호정보 범용 프록시 라우트
app.get('/api/proxy/utic', async (req, res) => {
  let { url, regionCode, itstNm } = req.query;
  
  // URL 파라미터가 없으면 기존 구버전 요청(React 앱 등)을 위해 조립
  if (!url) {
    if (regionCode && itstNm) {
      url = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?regionCode=${regionCode}&itstNm=${encodeURIComponent(itstNm)}&type=json`;
    } else {
      return res.status(400).json({ error: 'url 파라미터 또는 regionCode와 itstNm이 필요합니다.' });
    }
  }

  if (!url.includes('serviceKey=')) {
    url += (url.includes('?') ? '&' : '?') + 'serviceKey=' + UTIC_API_KEY;
  }
  
  try {
    const response = await fetchUrl(url);
    res.json(response.data);
  } catch (error) {
    console.error('UTIC API 호출 에러:', error.message);
    res.status(500).json({ error: 'UTIC 통신 실패' });
  }
});

// 3. 서울 T-Data 실시간 신호정보 프록시 (10119 상태 + 10120 잔여시간 통합)
app.get('/api/proxy/seoul', async (req, res) => {
  const { intersectionId } = req.query;
  
  if (!SEOUL_API_KEY) {
    return res.status(500).json({ error: 'SEOUL_API_KEY가 설정되지 않았습니다.' });
  }

  const url10119 = intersectionId 
    ? `http://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseInformation/1.0?apiKey=${SEOUL_API_KEY}&type=json&itstId=${intersectionId}`
    : `http://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseInformation/1.0?apiKey=${SEOUL_API_KEY}&type=json`;

  const url10120 = intersectionId 
    ? `http://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingInformation/1.0?apiKey=${SEOUL_API_KEY}&type=json&itstId=${intersectionId}`
    : `http://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingInformation/1.0?apiKey=${SEOUL_API_KEY}&type=json`;

  try {
    const [resStatus, resTiming] = await Promise.all([
      axios.get(url10119).catch(e => { console.error('Seoul 10119 error:', e.message); return { data: [] }; }),
      axios.get(url10120).catch(e => { console.error('Seoul 10120 error:', e.message); return { data: [] }; })
    ]);

    res.json({
      status: resStatus.data,
      timing: resTiming.data
    });
  } catch (error) {
    console.error('Seoul API 호출 에러:', error.message);
    res.status(500).json({ error: '서울 T-Data API 통신 실패' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Sigma Backend Server is running on port ${PORT}`);
});

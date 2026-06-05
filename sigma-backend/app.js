const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const xlsx = require('xlsx');
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
    throw new Error('UTIC 교차로 엑셀 데이터를 가져오는데 실패했습니다: ' + err.message);
  }

  const workbook = xlsx.read(res.data, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawItems = xlsx.utils.sheet_to_json(sheet);

  if (!rawItems || rawItems.length === 0) {
    throw new Error('UTIC 교차로 엑셀 데이터가 비어있습니다.');
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

// 1-2. 교차로 마스터 데이터 조회 (Supabase)
app.get('/api/intersections', async (req, res) => {
  const { regionCode } = req.query;
  try {
    let query = supabase.from('utic_intersections').select('*');
    if (regionCode) {
      query = query.eq('region_cd', regionCode);
    }
    const { data, error } = await query;
    if (error) throw error;
    
    // 데이터가 없거나 24시간이 지났으면 자동 갱신
    if (regionCode && (data.length === 0 || (new Date() - new Date(data[0].updated_at) > 24 * 60 * 60 * 1000))) {
      console.log(`[Sync] ${regionCode} 교차로 데이터 자동 갱신 수행`);
      const syncedData = await syncUticIntersections(regionCode);
      return res.json(syncedData);
    }
    
    res.json(data);
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

// 3. 서울 T-Data 실시간 신호정보 프록시 라우트
app.get('/api/proxy/seoul', async (req, res) => {
  // 실제 서울시 API 엔드포인트에 맞춰 수정 필요
  const { intersectionId } = req.query;
  
  try {
    // 임시 엔드포인트 예시
    const url = `http://t-data.seoul.go.kr/api/example?apikey=${SEOUL_API_KEY}&id=${intersectionId}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('Seoul API 호출 에러:', error.message);
    res.status(500).json({ error: '서울 T-Data API 통신 실패' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Sigma Backend Server is running on port ${PORT}`);
});

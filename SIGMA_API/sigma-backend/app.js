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

// [성능 최적화] /api/sim/data CSV 응답 메모리 캐시 (100배 속도 향상)
const CSV_CACHE = {};

// 캐시 무효화 미들웨어: 데이터 변경(POST/PUT/DELETE) 시 캐시를 날림
app.use('/api', (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        Object.keys(CSV_CACHE).forEach(k => delete CSV_CACHE[k]);
        console.log(`[Cache] Cleared due to ${req.method} ${req.url}`);
    }
    next();
});

// 통합 랜딩 페이지 및 서비스 서빙 설정
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});
app.use('/landing_assets', express.static(path.join(__dirname, '../../landing_assets')));
app.use('/sim', express.static(path.join(__dirname, '../../SIGMA_SIM')));
app.use('/realtime', express.static(path.join(__dirname, '../sigma-frontend/dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
const sendIndexHtml = (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../sigma-frontend/dist/index.html'));
};
app.get('/realtime', sendIndexHtml);
app.get(/^\/realtime\/.*/, sendIndexHtml);

const PORT = process.env.PORT || 3000;
const UTIC_API_KEY = process.env.UTIC_API_KEY;
const UTIC_SERVICE_KEY = process.env.UTIC_SERVICE_KEY;
const SEOUL_API_KEY = process.env.SEOUL_API_KEY;
const DOTHOME_BRIDGE_URL = process.env.DOTHOME_BRIDGE_URL || '';
const BRIDGE_SECRET_KEY = process.env.BRIDGE_SECRET_KEY;

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

async function fetchUrl(url) {
  if (!isValidProxyUrl(url)) {
    throw new Error('허용되지 않은 외부 URL 요청입니다.');
  }
  if (DOTHOME_BRIDGE_URL && !DOTHOME_BRIDGE_URL.includes('your-dothome-domain') && DOTHOME_BRIDGE_URL.trim() !== '') {
    if (!BRIDGE_SECRET_KEY) {
      throw new Error('BRIDGE_SECRET_KEY가 설정되지 않았습니다.');
    }
    return await axios.get(DOTHOME_BRIDGE_URL, {
      params: { url: url },
      headers: { 'X-Secret-Token': BRIDGE_SECRET_KEY }
    });
  }
  // 브릿지 설정이 없으면 백엔드(Node.js)에서 직접 호출 (CORS 제한 없음)
  return await axios.get(url);
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

// 1-0. 보호구역 데이터 로드 (Supabase 페이징 우회)
app.get('/api/safetyzone', async (req, res) => {
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
      
      const { data, error } = await query.range(from, from + step - 1);
        
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      if (data.length < step) break;
      from += step;
    }
    
    // 프론트엔드가 처리하기 편하도록 키 매핑
    const items = allData.map(row => ({
      ptznMngNo: row.ptznmngno,
      trgtFcltNm: row.name,
      sggCd: row.sggcd,
      fcltTypeCd: row.type,
      geojson: row.geojson
    }));
    
    res.json({ success: true, items: items });
  } catch (err) {
    console.error('Error fetching safety zones:', err);
    res.status(500).json({ error: err.message });
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
  if (password !== '1234') {
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
    sendErrorResponse(res, err, '가장 가까운 교차로 조회 중 오류가 발생했습니다.');
  }
});


// 1-2. 교차로 마스터 데이터 조회 (Supabase)
app.get('/api/intersections', async (req, res) => {
  const { regionCode } = req.query;
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
    sendErrorResponse(res, err, '각도 설정 저장 중 오류가 발생했습니다.');
  }
});

// 1-3. 시뮬레이터용 데이터 반환 API (RDB 테이블 실시간 쿼리 및 CSV 동적 변환 서빙)
app.get('/api/sim/data', async (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'file 파라미터가 필요합니다.' });

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (CSV_CACHE[file]) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send(CSV_CACHE[file]);
  }

  let cacheBuffer = "";
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = function(chunk) {
      cacheBuffer += chunk;
      return originalWrite(chunk);
  };

  res.end = function(chunk) {
      if (chunk) cacheBuffer += chunk;
      CSV_CACHE[file] = cacheBuffer;
      return originalEnd(chunk);
  };

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
          
          const headers = ["ID", "Region", "Name", "Lat", "Lng", "Seq", "Police", "Office", "GroupID", "FlashCfg", "OpIntervention", "ArrowConfigs", "Controller", "DiagramOrder", "Weekly_plan", "API_Int_No"];
          res.write("\ufeff" + headers.join(",") + "\n");
          
          let page = 0;
          const pageSize = 500;
          let hasMore = true;
          
          while (hasMore) {
            const { data, error } = await supabase.from('junctions').select('*').eq('region_cd', regionCode).order('id').range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (!data || data.length === 0) break;
            
            let chunk = "";
            data.forEach(r => {
              // arrowConfigs & _custom_angles 복원
              let arrowStr = "";
              if (r.arrow_configs && typeof r.arrow_configs === 'object') {
                const arrs = [];
                Object.entries(r.arrow_configs).forEach(([mov, configs]) => {
                  if (mov === '_custom_angles') {
                    if (configs && typeof configs === 'object') {
                      Object.entries(configs).forEach(([pfx, angle]) => {
                        arrs.push(`_custom_angles:${pfx}:${angle}`);
                      });
                    }
                  } else if (Array.isArray(configs)) {
                    configs.forEach(c => {
                      arrs.push(`${mov}:${c.dLat}:${c.dLng}:${c.rot}`);
                    });
                  }
                });
                arrowStr = arrs.join(';');
              }
              
              const line = [
                r.id,
                r.region_cd,
                r.name,
                r.lat ? Number(r.lat).toFixed(9) : "37.5",
                r.lng ? Number(r.lng).toFixed(9) : "127.0",
                r.seq || "",
                r.police || "",
                r.office || "",
                r.group_id || 0,
                "0|||", // flash_cfg 제외
                "0|",    // op_intervention 제외
                arrowStr,
                r.controller || "",
                r.diagram_order !== null ? r.diagram_order : -1,
                r.weekly_plan || "1;1;1;1;1;2;3",
                r.api_int_no !== null && r.api_int_no !== undefined ? r.api_int_no : ""
              ];
              chunk += line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
            });
            
            res.write(chunk);
            if (data.length < pageSize) hasMore = false;
            page++;
          }
          return res.end();
        }
        
        // B. 신호 현시계획 (signal_maps 테이블 쿼리 및 CSV 재가공)
        if (type === 'signal_maps') {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');
          
          const headers = ["ID", "MapIdx", "movA", "movB", "pedMovA", "pedMovB", "mainMovements", "yellowA", "yellowB", "allredA", "allredB", "pedA", "pedB", "pedDelayA", "pedDelayB", "pedFlashA", "pedFlashB", "pedGreenA", "pedGreenB", "rawSteps"];
          res.write("\ufeff" + headers.join(",") + "\n");
          
          let page = 0;
          const pageSize = 500;
          let hasMore = true;
          
          while (hasMore) {
            const { data, error } = await supabase.from('signal_maps').select('*').like('id', `${regionCode}-%`).order('id').range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (!data || data.length === 0) break;
            
            let chunk = "";
            data.forEach(r => {
              const line = [
                r.id,
                r.map_idx,
                Array.isArray(r.mov_a) ? r.mov_a.join(';') : (r.mov_a || ""),
                Array.isArray(r.mov_b) ? r.mov_b.join(';') : (r.mov_b || ""),
                Array.isArray(r.ped_mov_a) ? r.ped_mov_a.join(';') : (r.ped_mov_a || ""),
                Array.isArray(r.ped_mov_b) ? r.ped_mov_b.join(';') : (r.ped_mov_b || ""),
                Array.isArray(r.main_movements) ? r.main_movements.join(';') : (r.main_movements || "A0;B0"),
                Array.isArray(r.yellow_a) ? r.yellow_a.join(';') : (r.yellow_a || ""),
                Array.isArray(r.yellow_b) ? r.yellow_b.join(';') : (r.yellow_b || ""),
                Array.isArray(r.allred_a) ? r.allred_a.join(';') : (r.allred_a || ""),
                Array.isArray(r.allred_b) ? r.allred_b.join(';') : (r.allred_b || ""),
                Array.isArray(r.ped_a) ? r.ped_a.join(';') : (r.ped_a || ""),
                Array.isArray(r.ped_b) ? r.ped_b.join(';') : (r.ped_b || ""),
                Array.isArray(r.ped_delay_a) ? r.ped_delay_a.join(';') : (r.ped_delay_a || ""),
                Array.isArray(r.ped_delay_b) ? r.ped_delay_b.join(';') : (r.ped_delay_b || ""),
                Array.isArray(r.ped_flash_a) ? r.ped_flash_a.join(';') : (r.ped_flash_a || ""),
                Array.isArray(r.ped_flash_b) ? r.ped_flash_b.join(';') : (r.ped_flash_b || ""),
                Array.isArray(r.ped_green_a) ? r.ped_green_a.join(';') : (r.ped_green_a || ""),
                Array.isArray(r.ped_green_b) ? r.ped_green_b.join(';') : (r.ped_green_b || ""),
                r.raw_steps ? JSON.stringify(r.raw_steps) : ""
              ];
              chunk += line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
            });
            
            res.write(chunk);
            if (data.length < pageSize) hasMore = false;
            page++;
          }
          return res.end();
        }
        
        // C. TOD 운영계획 (tod_plans 테이블 쿼리 및 CSV 재가공)
        if (type === 'tod_plans') {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');
          
          const headers = ["ID", "Seq", "SignalMap", "GroupID", "Day_plan"];
          for (let i = 1; i <= 16; i++) headers.push(`Time_plan${i}`);
          res.write("\ufeff" + headers.join(",") + "\n");
          
          let page = 0;
          const pageSize = 500;
          let hasMore = true;
          
          while (hasMore) {
            const { data, error } = await supabase.from('tod_plans').select('*').like('id', `${regionCode}-%`).order('id').order('day_plan').range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (!data || data.length === 0) break;
            
            let chunk = "";
            data.forEach(r => {
              const line = [r.id, r.id, r.signal_map || 0, r.group_id || 0, r.day_plan];
              
              // 16개 시간계획 복원
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
              
              chunk += line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
            });
            
            res.write(chunk);
            if (data.length < pageSize) hasMore = false;
            page++;
          }
          return res.end();
        }
        
        // D. 제어 그룹마스터 (groups 테이블 쿼리 및 CSV 재가공)
        if (type === 'groups') {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');
          
          const headers = ["GroupID", "Region", "Name"];
          for (let i = 1; i <= 10; i++) headers.push(`Day_plan${i}`);
          res.write("\ufeff" + headers.join(",") + "\n");
          
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
            
            res.write(chunk);
            if (data.length < pageSize) hasMore = false;
            page++;
          }
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

    res.send(fileContent);
  } catch (err) {
    sendErrorResponse(res, err, '시뮬레이터 데이터 조회에 실패했습니다.');
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
        countQuery = countQuery.like('id', `${regionCode}-%`);
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
          q = q.like('id', `${regionCode}-%`);
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

// 1-3-C. 데이터 뷰어용 일괄 수정/추가(Bulk Upsert) API
app.post('/api/sim/tables/:tableName/bulk', async (req, res) => {
  const { tableName } = req.params;
  const { password, records } = req.body;
  
  if (password !== '1234') {
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
        arrowStr = Object.entries(jRow.arrow_configs).flatMap(([mov, configs]) => 
          (configs || []).map(c => `${mov}:${c.dLat}:${c.dLng}:${c.rot}`)
        ).join(';');
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
    sendErrorResponse(res, err, '교차로 데이터 복원에 실패했습니다.');
  }
});

// 1-5. 교차로별 DB 업데이트 API (동시성 제어 적용)
app.post('/api/sim/update-junction', async (req, res) => {
  const { jid, interCsvLine, mapCsvLines, todCsvLines, statsCsvLines } = req.body;
  if (!jid) return res.status(400).json({ error: 'jid가 필요합니다.' });

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

      return { success: true };
    });

    res.json(result);
  } catch (err) {
    sendErrorResponse(res, err, '교차로 데이터 업데이트에 실패했습니다.');
  }
});

// 1-4-OSM. OSM 반경 차로 데이터 자동 추출 및 캐싱
app.post('/api/sim/osm-lanes', async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'lat, lng가 필요합니다.' });

  try {
    // 1. Supabase PostGIS RPC 호출로 10m 이내 캐시 데이터 확인 (수동 갱신을 위해 캐시 무시 또는 기록용으로만 사용)
    const { data: cached, error: cacheErr } = await supabase.rpc('get_cached_osm_lanes', {
      p_lat: parseFloat(lat),
      p_lng: parseFloat(lng),
      p_radius_meters: 10
    });

    // 2. 백엔드에서 Overpass API 직접 호출 (CORS 우회 및 원본 데이터 수집)
    const query = `
      [out:json];
      (
        way(around:30,${lat},${lng})["highway"];
      );
      (._;>;);
      out body;
    `;
    
    // Node.js 내장 fetch 활용 (axios 406 헤더 제약 회피)
    const osmRes = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: {
            'User-Agent': 'SigmaProject-TrafficAnalyzer/1.0',
            'Accept': 'application/json, text/plain, */*'
        }
    });
    
    if (!osmRes.ok) {
        throw new Error(`Overpass API 오류: ${osmRes.status} ${osmRes.statusText}`);
    }
    
    const osmData = await osmRes.json();

    if (!osmData || !osmData.elements) {
      return res.status(400).json({ error: 'osmData 요소가 없습니다.' });
    }

    // 3. 파싱 로직 수행 (정밀 위상 수학 로직)
    const elements = osmData.elements;
    const nodes = {};
    const ways = [];
    
    elements.forEach(el => {
      if (el.type === 'node') nodes[el.id] = el;
      if (el.type === 'way' && el.tags && el.tags.highway) ways.push(el);
    });

    // 3.1 대상 교차로 중심과 가장 가까운 노드(교차점) 탐색
    let centerNodeId = null;
    let minDiff = Infinity;
    for (const [nid, node] of Object.entries(nodes)) {
      const diff = Math.abs(node.lat - lat) + Math.abs(node.lon - lng);
      if (diff < minDiff) {
        minDiff = diff;
        centerNodeId = parseInt(nid);
      }
    }

    if (!centerNodeId) {
      return res.json({ success: false, message: '주변 OSM 노드를 찾을 수 없습니다.' });
    }

    // 방위각 계산 유틸리티
    const getBearing = (lat1, lon1, lat2, lon2) => {
      const toRad = (deg) => deg * Math.PI / 180;
      const toDeg = (rad) => rad * 180 / Math.PI;
      const dLon = toRad(lon2 - lon1);
      const y = Math.sin(dLon) * Math.cos(toRad(lat2));
      const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - 
                Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
      return (toDeg(Math.atan2(y, x)) + 360) % 360;
    };

    const getDirection = (angle) => {
      if (angle >= 337.5 || angle < 22.5) return 'S';      
      if (angle >= 22.5 && angle < 67.5) return 'SW';
      if (angle >= 67.5 && angle < 112.5) return 'W';      
      if (angle >= 112.5 && angle < 157.5) return 'NW';
      if (angle >= 157.5 && angle < 202.5) return 'N';     
      if (angle >= 202.5 && angle < 247.5) return 'NE';
      if (angle >= 247.5 && angle < 292.5) return 'E';     
      if (angle >= 292.5 && angle < 337.5) return 'SE';
      return 'N';
    };

    // 3.2 진입 차로(Incoming) 계산 로직
    const incomingLanes = { N: 0, E: 0, S: 0, W: 0, NE: 0, SE: 0, SW: 0, NW: 0 };
    
    ways.forEach(way => {
      const idx = way.nodes.indexOf(centerNodeId);
      if (idx === -1) return; 

      const oneway = way.tags.oneway;
      const lanesTotal = parseInt(way.tags.lanes) || 1;
      const lanesFwd = parseInt(way.tags['lanes:forward']);
      const lanesBwd = parseInt(way.tags['lanes:backward']);

      // 1) 정방향 진입로 (이전 노드 -> Target Node)
      if (idx > 0 && oneway !== "-1") {
        let laneCount = 1;
        if (!isNaN(lanesFwd)) {
            laneCount = lanesFwd;
        } else if (oneway === "yes" || oneway === "1") {
            laneCount = lanesTotal;
        } else {
            laneCount = Math.max(1, Math.floor(lanesTotal / 2));
        }

        const prevNodeId = way.nodes[idx - 1];
        if (nodes[prevNodeId]) {
            const bearing = getBearing(nodes[prevNodeId].lat, nodes[prevNodeId].lon, nodes[centerNodeId].lat, nodes[centerNodeId].lon);
            const dir = getDirection(bearing);
            if (laneCount > incomingLanes[dir]) incomingLanes[dir] = laneCount;
        }
      }

      // 2) 역방향 진입로 (다음 노드 -> Target Node)
      if (idx < way.nodes.length - 1 && oneway !== "yes" && oneway !== "1") {
        let laneCount = 1;
        if (!isNaN(lanesBwd)) {
            laneCount = lanesBwd;
        } else if (oneway === "-1") {
            laneCount = lanesTotal;
        } else {
            laneCount = Math.max(1, Math.floor(lanesTotal / 2));
        }

        const nextNodeId = way.nodes[idx + 1];
        if (nodes[nextNodeId]) {
            const bearing = getBearing(nodes[nextNodeId].lat, nodes[nextNodeId].lon, nodes[centerNodeId].lat, nodes[centerNodeId].lon);
            const dir = getDirection(bearing);
            if (laneCount > incomingLanes[dir]) incomingLanes[dir] = laneCount;
        }
      }
    });

    // 4. 계산된 결과를 Supabase에 저장 (캐싱)
    const { error: insertErr } = await supabase.from('osm_intersection_lanes').insert({
      lat: lat,
      lng: lng,
      lanes_data: incomingLanes
    });
    
    if (insertErr) {
      console.warn("OSM Cache Insert Warning:", insertErr.message);
    }

    res.json({ success: true, cached: false, lanes: incomingLanes, rawWays: ways, rawNodes: nodes });

  } catch (err) {
    sendErrorResponse(res, err, 'OSM 차로 데이터 추출 중 오류가 발생했습니다.');
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
    sendErrorResponse(res, err, '민원 데이터 일괄 업데이트에 실패했습니다.');
  }
});

// 1-6. 특정 교차로(JID)의 UTIC 신호 계획 동기화 API 구현
app.post('/api/sim/sync-utic-plan', async (req, res) => {
  const { jid, itstNm } = req.body;
  if (!jid || !itstNm) return res.status(400).json({ error: 'jid와 itstNm이 필요합니다.' });

  try {
    const region = jid.split('-')[0];
    const targetRegion = (region === 'L01' || region === 'L02') ? region : 'L01';
    const apiRegion = targetRegion === 'L01' ? '110' : targetRegion;

    const targetServiceKey = UTIC_SERVICE_KEY || UTIC_API_KEY;
    const url = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?regionCode=${apiRegion}&itstNm=${encodeURIComponent(itstNm)}&type=json&serviceKey=${targetServiceKey}`;

    const response = await axios.get(url);
    const data = response.data;
    const items = Array.isArray(data) ? data : (data.body && data.body.items ? data.body.items : null);

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'UTIC API로부터 신호 운영 계획을 가져오지 못했거나 계획 정보가 존재하지 않습니다.' });
    }

    // UTIC 계획 데이터를 tod plans CSV 라인들로 파싱
    // db_tod_plans.csv 구조: ID,Seq,SignalMap,GroupID,Day_plan,Time_plan1,Time_plan2...
    // UTIC에서 받은 주간계획을 시뮬레이터 포맷으로 가공 및 업데이트 수행
    const newTodLines = [];
    const timePlans = Array(16).fill("-1|100|0|0;0;0;0;0;0;0;0|0;0;0;0;0;0;0;0|1");

    // 그룹화 및 스케줄 시간순 정렬
    const plansByDay = {}; // 1~10 일계획 매핑
    items.forEach(item => {
      // PLAN_TP: "0" (TOD계획), PLAN_NO: 일계획 번호
      const dayPlan = parseInt(item.PLAN_NO) || 1;
      if (dayPlan < 1 || dayPlan > 10) return;
      if (!plansByDay[dayPlan]) plansByDay[dayPlan] = [];
      plansByDay[dayPlan].push(item);
    });

    const todPayload = [];

    for (let day = 1; day <= 10; day++) {
      const dayItems = plansByDay[day] || [];
      // 시작시간(START_TM: HHMM) 기준 오름차순 정렬
      dayItems.sort((a, b) => String(a.START_TM).localeCompare(String(b.START_TM)));

      const timePlans = [];
      for (let sIdx = 0; sIdx < 16; sIdx++) {
        const item = dayItems[sIdx];
        if (item) {
          const hh = item.START_TM.substring(0, 2);
          const mm = item.START_TM.substring(2, 4);
          
          const splitsA = [];
          const splitsB = [];
          for (let i = 1; i <= 8; i++) {
            splitsA.push(parseInt(item[`SPLIT_A${i}`]) || 0);
            splitsB.push(parseInt(item[`SPLIT_B${i}`]) || 0);
          }

          timePlans.push({
            slot_idx: sIdx + 1,
            h: parseInt(hh) || 0,
            m: parseInt(mm) || 0,
            cycle: parseInt(item.CYC_TM) || 100,
            offset: parseInt(item.OFS_TM) || 0,
            splitA: splitsA,
            splitB: splitsB,
            idx: 1
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

    const result = await enqueueDBWrite(async () => {
      const { error: tErr } = await supabase
        .from('tod_plans')
        .upsert(todPayload, { onConflict: 'id,day_plan' });
      
      if (tErr) {
        throw new Error(`tod_plans RDB 업서트 에러: ${tErr.message}`);
      }

      return { success: true };
    });

    res.json(result);
  } catch (err) {
    sendErrorResponse(res, err, 'UTIC 신호 계획 동기화 및 DB 반영에 실패했습니다.');
  }
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

const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';


// --- 보호구역 API Proxy ---
let safetyZoneCache = null;
let safetyZoneCacheTime = 0;

app.get('/api/sim/safetyzone', async (req, res) => {
  try {
        const data = await fetchAllSupabase(() => supabase.from('safety_zones').select('*'));
    

    
    
    // 프론트엔드 호환성을 위해 geojson 키 유지
    const items = data.map(row => ({
      ptznMngNo: row.ptznmngno,
      trgtFcltNm: row.name,
      sggCd: row.sggcd,
      fcltTypeCd: row.type,
      geojson: row.geojson
    }));

    res.json({ success: true, items: items, source: 'supabase' });
  } catch (err) {
    console.error("보호구역 DB 프록시 오류:", err);
    res.status(500).json({ error: err.message });
  }
});
app.listen(PORT, HOST, () => {
  console.log(`🚀 Sigma Backend Server is running on http://${HOST}:${PORT}`);
});

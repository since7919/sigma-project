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
app.use(express.json());

// 통합 랜딩 페이지 및 서비스 서빙 설정
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});
app.use('/landing_assets', express.static(path.join(__dirname, '../../landing_assets')));
app.use('/sim', express.static(path.join(__dirname, '../../SIGMA_SIM')));
app.use('/realtime', express.static(path.join(__dirname, '../sigma-frontend/dist')));
app.get('/realtime', (req, res) => {
  res.sendFile(path.join(__dirname, '../sigma-frontend/dist/index.html'));
});
app.get(/^\/realtime\/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../sigma-frontend/dist/index.html'));
});

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
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: isDev ? error.message : defaultMessage
  });
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
      .select('region_cd, int_no, int_nm, x_coord, y_coord, node_id, origin_type')
      .eq('region_cd', region)
      .limit(5000);

    if (error) throw error;
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
    sendErrorResponse(res, error, '교차로 정보 조회에 실패했습니다.');
  }
});

// 1-3. 시뮬레이터용 데이터 반환 API (RDB 테이블 실시간 쿼리 및 CSV 동적 변환 서빙)
app.get('/api/sim/data', async (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'file 파라미터가 필요합니다.' });

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
          const { data: rows, error } = await supabase
            .from('junctions')
            .select('*')
            .eq('region_cd', regionCode)
            .order('id');
          if (error) throw error;
          
          const headers = ["ID", "Region", "Name", "Lat", "Lng", "Seq", "Police", "Office", "GroupID", "FlashCfg", "OpIntervention", "ArrowConfigs", "Controller", "DiagramOrder", "Weekly_plan", "API_Int_No"];
          let csvContent = "\ufeff" + headers.join(",") + "\n";
          
          (rows || []).forEach(r => {
            // arrowConfigs 복원
            let arrowStr = "";
            if (r.arrow_configs && typeof r.arrow_configs === 'object') {
              arrowStr = Object.entries(r.arrow_configs).flatMap(([mov, configs]) => 
                (configs || []).map(c => `${mov}:${c.dLat}:${c.dLng}:${c.rot}`)
              ).join(';');
            }
            
            const line = [
              r.id,
              r.region_cd,
              r.name,
              r.lat.toFixed(9),
              r.lng.toFixed(9),
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
            csvContent += line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
          });
          
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send(csvContent);
        }
        
        // B. 신호 현시계획 (signal_maps 테이블 쿼리 및 CSV 재가공)
        if (type === 'signal_maps') {
          const { data: jList, error: jErr } = await supabase
            .from('junctions')
            .select('id')
            .eq('region_cd', regionCode);
          if (jErr) throw jErr;
          
          const jids = (jList || []).map(j => j.id);
          const { data: rows, error } = await supabase
            .from('signal_maps')
            .select('*')
            .in('id', jids)
            .order('id')
            .order('map_idx');
          if (error) throw error;
          
          const headers = ["ID", "MapIdx", "movA", "movB", "pedMovA", "pedMovB", "mainMovements", "yellowA", "yellowB", "allredA", "allredB", "pedA", "pedB", "pedDelayA", "pedDelayB", "pedFlashA", "pedFlashB", "pedGreenA", "pedGreenB", "startTime", "endTime"];
          let csvContent = "\ufeff" + headers.join(",") + "\n";
          
          (rows || []).forEach(r => {
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
              r.start_time || "",
              r.end_time || ""
            ];
            csvContent += line.map(v => String(v)).join(",") + "\n";
          });
          
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send(csvContent);
        }
        
        // C. TOD 운영계획 (tod_plans 테이블 쿼리 및 CSV 재가공)
        if (type === 'tod_plans') {
          const { data: jList, error: jErr } = await supabase
            .from('junctions')
            .select('id')
            .eq('region_cd', regionCode);
          if (jErr) throw jErr;
          
          const jids = (jList || []).map(j => j.id);
          const { data: rows, error } = await supabase
            .from('tod_plans')
            .select('*')
            .in('id', jids)
            .order('id')
            .order('day_plan');
          if (error) throw error;
          
          const headers = ["ID", "Seq", "SignalMap", "GroupID", "Day_plan"];
          for (let i = 1; i <= 16; i++) headers.push(`Time_plan${i}`);
          let csvContent = "\ufeff" + headers.join(",") + "\n";
          
          (rows || []).forEach(r => {
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
            
            csvContent += line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
          });
          
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send(csvContent);
        }
        
        // D. 제어 그룹마스터 (groups 테이블 쿼리 및 CSV 재가공)
        if (type === 'groups') {
          const { data: rows, error } = await supabase
            .from('groups')
            .select('*')
            .eq('region_cd', regionCode)
            .order('group_id');
          if (error) throw error;
          
          const headers = ["GroupID", "Region", "Name"];
          for (let i = 1; i <= 10; i++) headers.push(`Day_plan${i}`);
          let csvContent = "\ufeff" + headers.join(",") + "\n";
          
          (rows || []).forEach(r => {
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
            
            csvContent += line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
          });
          
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send(csvContent);
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

    if (file.endsWith('.geojson')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else if (file.endsWith('.csv')) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    } else {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }

    res.send(data.file_content);
  } catch (err) {
    sendErrorResponse(res, err, '시뮬레이터 데이터 조회에 실패했습니다.');
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
    let query = supabase.from(tableName).select('*');
    
    // junctions나 groups는 region_cd 필드가 직접 존재함
    // signal_maps나 tod_plans는 직접 region_cd가 없으므로 id 접두사로 필터링해야 할 수 있음.
    // 일단 전체 데이터를 주거나, 지원 가능한 경우만 필터링.
    if (regionCode) {
      if (tableName === 'junctions' || tableName === 'groups') {
        query = query.eq('region_cd', regionCode);
      } else {
         query = query.like('id', `${regionCode}-%`);
      }
    }
    
    // 테이블 크기가 클 수 있으므로 limit을 적절히 주거나 전체 로딩. 
    // 여기서는 뷰어 목적이므로 최대 5000건 정도로 제한
    query = query.limit(5000);
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.json(data);
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
    // 빈 셀들이나 잘못된 데이터로 인한 오류 방지를 위해, 필수 키(예: id, ID)가 있는 레코드만 필터링
    const validRecords = records.filter(r => (r.id || r.ID) !== undefined && String(r.id || r.ID).trim() !== '');
    
    if (validRecords.length === 0) {
      return res.status(400).json({ error: '유효한 레코드(ID 포함)가 존재하지 않습니다. CSV 형식을 확인해주세요.' });
    }

    // 카멜케이스(CamelCase) 또는 대문자 헤더를 Supabase 스네이크케이스(snake_case)로 변환
    const processedRecords = validRecords.map(row => {
      const newRow = {};
      for (let key in row) {
        let snakeKey = key;
        
        // 특정 키 강제 매핑
        if (key.toUpperCase() === 'ID') snakeKey = 'id';
        else if (key === 'MapIdx') snakeKey = 'map_idx';
        else if (key === 'SignalMap') snakeKey = 'signal_map';
        else if (key === 'GroupID' || key === 'GroupId') snakeKey = 'group_id';
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
        else if (key.startsWith('Time_plan')) snakeKey = key.toLowerCase();
        else {
          // 일반 camelCase -> snake_case
          snakeKey = key.replace(/^([A-Z])/, m => m.toLowerCase()).replace(/([A-Z])/g, m => '_' + m.toLowerCase());
        }

        let val = row[key];
        // Parse arrays/objects
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        
        // 값이 빈 문자열이면 null로 처리할지? Supabase 제약조건에 따라 다르지만 보통 빈칸은 그대로 두거나 null
        if (val === '') val = null;

        newRow[snakeKey] = val;
      }
      return newRow;
    });

    let conflictKeys = 'id';
    if (tableName === 'signal_maps') conflictKeys = 'id, map_idx';
    if (tableName === 'tod_plans') conflictKeys = 'id, seq';

    const { data, error } = await supabase
      .from(tableName)
      .upsert(processedRecords, { onConflict: conflictKeys }); // 복합키 충돌 처리
      
    if (error) throw error;
    
    res.json({ success: true, count: processedRecords.length, message: `${processedRecords.length}건이 성공적으로 저장되었습니다.` });
  } catch (err) {
    sendErrorResponse(res, err, `${tableName} 테이블 대량 업데이트에 실패했습니다.`);
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
  for (let c = 0; c < line.length; c++) {
    if (line[c] === '"') inQ = !inQ;
    else if (line[c] === ',' && !inQ) {
      cols.push(line.substring(start, c).replace(/^"|"$/g,'').trim());
      start = c + 1;
    }
  }
  cols.push(line.substring(start).replace(/^"|"$/g,'').trim());
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
          r.start_time || "",
          r.end_time || ""
        ];
        return line.map(v => String(v)).join(",");
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
  const { jid, interCsvLine, mapCsvLines, todCsvLines } = req.body;
  if (!jid) return res.status(400).json({ error: 'jid가 필요합니다.' });

  try {
    const result = await enqueueDBWrite(async () => {
      const region = jid.split('-')[0];
      const targetRegion = (region === 'L01' || region === 'L02') ? region : 'L01';

      // 1) junctions 교차로 마스터 정보 업데이트
      if (interCsvLine !== undefined && interCsvLine.trim()) {
        const cols = parseCsvRow(interCsvLine);
        if (cols.length >= 8) {
          // arrowConfigs 복원
          let arrowConfigs = {};
          const arrowStr = cols[11];
          if (arrowStr) {
            arrowStr.split(';').forEach(conf => {
              const parts = conf.split(':');
              if (parts.length >= 4) {
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
            start_time: cols[19] || "",
            end_time: cols[20] || "",
            updated_at: new Date().toISOString()
          });
        }

        if (mapsPayload.length > 0) {
          const { error: mErr } = await supabase
            .from('signal_maps')
            .upsert(mapsPayload, { onConflict: 'id,map_idx' });
          if (mErr) throw new Error(`signal_maps RDB 업서트 오류: ${mErr.message}`);
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
              if (timeStr !== "-1") {
                const [h, m] = timeStr.split(':').map(Number);
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

      return { success: true };
    });

    res.json(result);
  } catch (err) {
    sendErrorResponse(res, err, '교차로 데이터 업데이트에 실패했습니다.');
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

const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Sigma Backend Server is running on http://${HOST}:${PORT}`);
});

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const wellknown = require('wellknown');
const proj4 = require('proj4');
require('dotenv').config();

proj4.defs("EPSG:5181","+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");

function transformCoords(coords) {
    if (typeof coords[0] === 'number') {
        if (Math.abs(coords[0]) > 180) {
            return proj4("EPSG:5181", "WGS84", coords);
        }
        return coords;
    } else {
        return coords.map(c => transformCoords(c));
    }
}

function transformGeoJSON(geojson) {
    if (!geojson) return geojson;
    if (geojson.type === 'GeometryCollection') {
        geojson.geometries = geojson.geometries.map(transformGeoJSON);
        return geojson;
    }
    if (geojson.coordinates) {
        geojson.coordinates = transformCoords(geojson.coordinates);
    }
    return geojson;
}


const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeAll() {
    console.log("=== 통합 보호구역 수집 스크립트 시작 (WKT 파싱) ===");
    
    // DB 확인
    const { data: existing } = await supabase.from('safety_zones').select('sggcd');
    const existingPrefixes = new Set();
    if (existing) {
        existing.forEach(d => {
            if (d.sggcd) existingPrefixes.add(d.sggcd.substring(0, 5));
        });
    }
    console.log(`[정보] DB에 이미 수집된 행정구역 수: ${existingPrefixes.size}개`);

    // 전체 행정구역 조회
    const regRes = await axios.get('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000');
    const allCodes = regRes.data.regcodes
        .map(r => r.code.substring(0, 5))
        .filter(c => !c.endsWith('000'))
        .filter((c, i, a) => a.indexOf(c) === i);
    
    const targetCodes = allCodes.filter(c => !existingPrefixes.has(c));
    console.log(`[정보] 앞으로 수집해야 할 행정구역 수: ${targetCodes.length}개`);
    
    let totalUpserted = 0;
    let apiCallCount = 0;
    const MAX_API_CALLS = 280;
    
    for (let i = 0; i < targetCodes.length; i++) {
        const sggCd = targetCodes[i];
        if (apiCallCount >= MAX_API_CALLS) {
            console.log(`[경고] 한도(${MAX_API_CALLS}회) 도달로 종료.`);
            break;
        }

        const apiUrl = `https://apis.data.go.kr/1320000/safetyzonedtlinfo/getdtllist?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&type=json&sggCd=${sggCd}`;
        
        let success = false;
        let retries = 0;
        
        while (!success && retries < 3) {
            try {
                apiCallCount++;
                const res = await axios.get(apiUrl, { timeout: 20000 });
                const items = res.data?.response?.body?.items?.item || res.data?.body?.items?.item;
                success = true;
                
                if (items) {
                    const arr = Array.isArray(items) ? items : [items];
                    const dbRows = arr.map(item => {
                        let geojson = null;
                        try {
                            const wkt = item.fturGeomVl;
                            const locStr = item.locData || '';
                            if (wkt && wkt.trim().length > 0) {
                                geojson = transformGeoJSON(wellknown.parse(wkt));
                            } else if (locStr) {
                                geojson = JSON.parse(locStr.replace(/'/g, '"'));
                            }
                        } catch (e) {
                            console.error('Parse error for', item.ptznMngNo, e.message);
                        }
                        
                        return {
                            ptznmngno: item.ptznMngNo,
                            name: item.trgtFcltNm || '',
                            type: item.fcltTypeCd || '1',
                            sggcd: item.sggCd || '',
                            geojson: geojson
                        };
                    }).filter(r => r.ptznmngno && r.geojson);
                    
                    if (dbRows.length > 0) {
                        const chunkSize = 200;
                        for (let j = 0; j < dbRows.length; j += chunkSize) {
                            const chunk = dbRows.slice(j, j + chunkSize);
                            await supabase.from('safety_zones').upsert(chunk, { onConflict: 'ptznmngno' });
                        }
                        totalUpserted += dbRows.length;
                        console.log(`[${sggCd}] ${dbRows.length}개 적재 완료 (총 ${totalUpserted}개) - API호출: ${apiCallCount}회`);
                    } else {
                        console.log(`[${sggCd}] 수집된 데이터 없음 (혹은 WKT/GeoJSON 없음)`);
                    }
                } else {
                    console.log(`[${sggCd}] API 결과 없음`);
                }
                
                await delay(5000);
            } catch (e) {
                if (e.response && e.response.status === 429) {
                    retries++;
                    console.log(`[${sggCd}] 429 에러! 60초 대기 후 재시도 (${retries}/3)...`);
                    apiCallCount--;
                    await delay(60000);
                } else {
                    console.error(`[${sggCd}] API 오류: ${e.message}`);
                    break;
                }
            }
        }
    }
    
    console.log(`\n=== 수집 종료 ===`);
    console.log(`새로 적재된 통합보호구역: ${totalUpserted}개`);
}

scrapeAll();

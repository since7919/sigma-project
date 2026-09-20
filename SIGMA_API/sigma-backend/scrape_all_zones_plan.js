const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeAll() {
    console.log("=== 안전한 전국 보호구역 수집 스크립트 시작 ===");
    
    // 1. DB에 이미 있는 지역 확인
    const { data: existing } = await supabase.from('safety_zones').select('sggcd');
    const existingPrefixes = new Set();
    if (existing) {
        existing.forEach(d => {
            if (d.sggcd) existingPrefixes.add(d.sggcd.substring(0, 5));
        });
    }
    console.log(`[정보] DB에 이미 수집된 행정구역 수: ${existingPrefixes.size}개`);

    // 2. 전체 행정구역 코드 조회
    const regRes = await axios.get('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000');
    const allCodes = regRes.data.regcodes
        .map(r => r.code.substring(0, 5))
        .filter(c => !c.endsWith('000'))
        .filter((c, i, a) => a.indexOf(c) === i);
    
    const targetCodes = allCodes.filter(c => !existingPrefixes.has(c));
    console.log(`[정보] 앞으로 수집해야 할 행정구역 수: ${targetCodes.length}개`);
    
    let totalUpserted = 0;
    let apiCallCount = 0;
    const MAX_API_CALLS = 280; // 300 한도 중 20회 여유분
    
    for (let i = 0; i < targetCodes.length; i++) {
        const sggCd = targetCodes[i];
        
        if (apiCallCount >= MAX_API_CALLS) {
            console.log(`[경고] 일일 트래픽 안전 한도(${MAX_API_CALLS}회)에 도달하여 수집을 일시 중지합니다.`);
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
                            let geomStr = item.locData || '';
                            if (geomStr) {
                                geomStr = geomStr.replace(/'/g, '"');
                                geojson = JSON.parse(geomStr);
                            }
                        } catch (e) {}
                        
                        return {
                            ptznmngno: item.ptznMngNo,
                            name: item.trgtFcltNm || '',
                            type: item.fcltTypeCd || '',
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
                        console.log(`[${sggCd}] 수집된 보호구역 없음`);
                    }
                } else {
                    console.log(`[${sggCd}] 해당 지역 보호구역 데이터 없음`);
                }
                
                // 성공 시 5초 대기 (분당 12회, 429 방지)
                await delay(5000);
                
            } catch (e) {
                if (e.response && e.response.status === 429) {
                    retries++;
                    console.log(`[${sggCd}] 429 에러 발생! 분당 트래픽 초과. 60초 대기 후 재시도 (${retries}/3)...`);
                    apiCallCount--; // 에러난 호출은 카운트 롤백 (단, 서버에서 차감했을 수 있음)
                    await delay(60000);
                } else {
                    console.error(`[${sggCd}] API 오류: ${e.message}`);
                    break; // 429가 아닌 다른 에러면 다음 지역으로 넘어감
                }
            }
        }
    }
    
    console.log(`\n=== 수집 종료 ===`);
    console.log(`새로 적재된 보호구역: ${totalUpserted}개`);
}

scrapeAll();

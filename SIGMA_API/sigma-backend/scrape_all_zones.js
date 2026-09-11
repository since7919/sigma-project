const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeAll() {
    console.log("Fetching all SGG codes...");
    const regRes = await axios.get('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000');
    const allCodes = regRes.data.regcodes
        .map(r => r.code.substring(0, 5))
        .filter(c => !c.endsWith('000'))
        .filter((c, i, a) => a.indexOf(c) === i);
    
    console.log(`Found ${allCodes.length} SGG codes. Starting scrape...`);
    
    let totalUpserted = 0;
    let skipCount = 0;
    
    for (const sggCd of allCodes) {
        // Skip Seoul and Incheon if we want, or just re-upsert. Let's re-upsert to be safe.
        // Wait, to save API calls, let's skip 11 (Seoul) and 28 (Incheon).
        if (sggCd.startsWith('11') || sggCd.startsWith('28')) {
            skipCount++;
            continue;
        }

        const apiUrl = `https://apis.data.go.kr/1320000/safetyzonedtlinfo/getdtllist?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&type=json&sggCd=${sggCd}`;
        
        try {
            const res = await axios.get(apiUrl, { timeout: 15000 });
            const items = res.data?.response?.body?.items?.item || res.data?.body?.items?.item;
            
            if (!items) {
                // No data for this region
                continue;
            }
            
            const arr = Array.isArray(items) ? items : [items];
            const dbRows = arr.map(item => {
                let geojson = null;
                try {
                    // Try to clean the string. The API returns WKT or pseudo-JSON
                    let geomStr = item.locData || '';
                    if (geomStr) {
                        geomStr = geomStr.replace(/'/g, '"');
                        geojson = JSON.parse(geomStr);
                    }
                } catch (e) {
                    // ignore invalid geojson
                }
                
                return {
                    ptznmngno: item.ptznMngNo,
                    name: item.trgtFcltNm || '',
                    type: item.fcltTypeCd || '',
                    sggcd: item.sggCd || '',
                    geojson: geojson
                };
            }).filter(r => r.ptznmngno && r.geojson);
            
            if (dbRows.length === 0) continue;
            
            // Upsert to Supabase
            const chunkSize = 200;
            for (let i = 0; i < dbRows.length; i += chunkSize) {
                const chunk = dbRows.slice(i, i + chunkSize);
                const { error } = await supabase.from('safety_zones').upsert(chunk, { onConflict: 'ptznmngno' });
                if (error) console.error(`DB Error on ${sggCd}:`, error.message);
            }
            
            totalUpserted += dbRows.length;
            console.log(`[${sggCd}] Upserted ${dbRows.length} zones. (Total so far: ${totalUpserted})`);
            
        } catch (e) {
            console.error(`[${sggCd}] API Error:`, e.message);
        }
        
        await delay(2000); // 2000ms delay to avoid HTTP 429 (Too Many Requests) between API calls
    }
    
    console.log(`\nDone! Skipped ${skipCount} codes. Upserted ${totalUpserted} NEW zones.`);
}

scrapeAll();

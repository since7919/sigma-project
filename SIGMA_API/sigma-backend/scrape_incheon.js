require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const proj4 = require('proj4');
const parseWkt = require('wellknown');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
proj4.defs('EPSG:5181', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs');

const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';
const incheonSggCds = ['28110', '28140', '28170', '28185', '28200', '28237', '28245', '28260', '28710', '28720'];

async function scrapeAndInsert() {
    console.log('Starting safety zones scraping for Incheon...');
    let allItems = [];
    
    for (const sggCd of incheonSggCds) {
        const apiUrl = 'https://apis.data.go.kr/1320000/safetyzonedtlinfo/getdtllist?serviceKey=' + serviceKey + '&pageNo=1&numOfRows=1000&type=json&sggCd=' + sggCd;
        try {
            console.log('Fetching ' + sggCd + '...');
            const response = await axios.get(apiUrl, { timeout: 10000 });
            let data = response.data;
            let items = [];
            if (data && data.response && data.response.body && data.response.body.items) {
                items = data.response.body.items.item || data.response.body.items;
                if (!Array.isArray(items)) items = [items];
            }
            allItems = allItems.concat(items);
            await new Promise(r => setTimeout(r, 300));
        } catch (e) {
            console.error('Error on ' + sggCd + ': ' + e.message);
        }
    }
    
    console.log('Fetched ' + allItems.length + ' records. Processing WKT to GeoJSON...');
    
    let dbRows = [];
    for (let item of allItems) {
        if (!item.ptznMngNo || !item.fturGeomVl) continue;
        
        let geojson = null;
        let newWkt = item.fturGeomVl.replace(/([\d.]+)\s+([\d.]+)/g, (m, x, y) => {
            const [lng, lat] = proj4('EPSG:5181', 'WGS84', [parseFloat(x), parseFloat(y)]);
            return lng + ' ' + lat;
        });
        
        try {
            geojson = parseWkt(newWkt);
        } catch (e) {
            console.error('Failed to parse WKT for ' + item.ptznMngNo);
        }
        
        dbRows.push({
            ptznmngno: item.ptznMngNo,
            name: item.trgtFcltNm || item.roadNmDaddr || '이름 없음',
            type: item.fcltTypeCd || '',
            sggcd: item.sggCd || '',
            geojson: geojson
        });
    }
    
    console.log('Prepared ' + dbRows.length + ' rows. Upserting into Supabase...');
    
    const chunkSize = 200;
    for (let i = 0; i < dbRows.length; i += chunkSize) {
        const chunk = dbRows.slice(i, i + chunkSize);
        const { error } = await supabase
            .from('safety_zones')
            .upsert(chunk, { onConflict: 'ptznmngno' });
            
        if (error) {
            console.error('Insert error chunk ' + i + ':', error.message);
        } else {
            console.log('Inserted chunk ' + i + ' to ' + (i + chunk.length));
        }
    }
    
    console.log('Finished scraping and inserting into DB!');
}

scrapeAndInsert();

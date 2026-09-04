const axios = require('axios');
const proj4 = require('proj4');
const parseWkt = require('wellknown');
proj4.defs('EPSG:5181', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs');

async function test() {
    try {
        const url = 'https://apis.data.go.kr/1320000/safetyzonedtlinfo/getdtllist?serviceKey=013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698&pageNo=1&numOfRows=1&type=json&sggCd=11110';
        const res = await axios.get(url);
        let items = res.data.response.body.items.item || res.data.response.body.items;
        if (!Array.isArray(items)) items = [items];
        
        let item = items[0];
        console.log('Original WKT:', item.fturGeomVl);
        const newWkt = item.fturGeomVl.replace(/([\d.]+)\s+([\d.]+)/g, (m, x, y) => {
            const [lng, lat] = proj4('EPSG:5181', 'WGS84', [parseFloat(x), parseFloat(y)]);
            return `${lng} ${lat}`;
        });
        console.log('New WKT:', newWkt);
        const geo = parseWkt(newWkt);
        console.log('GeoJSON:', JSON.stringify(geo));
    } catch (e) {
        console.error(e.message);
    }
}
test();

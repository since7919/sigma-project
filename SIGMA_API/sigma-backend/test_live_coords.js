const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('https://sigma-project-245n.onrender.com/api/safetyzone?regionCode=L01');
        const items = res.data.items;
        console.log(`First item sggCd: ${items[0].sggCd}, Name: ${items[0].trgtFcltNm}`);
        console.log(JSON.stringify(items[0].geojson).substring(0, 100));
        
        // Also check if there's any item with coordinates near Incheon (longitude ~126.6, latitude ~37.4)
        const incheonCoords = items.filter(i => {
            if (i.geojson && i.geojson.type === 'Point') {
                const [lng, lat] = i.geojson.coordinates;
                return lng < 126.8; // West of Seoul (Incheon area)
            }
            return false;
        });
        console.log(`Found ${incheonCoords.length} items with longitude < 126.8 in Seoul's data`);
    } catch (e) {
        console.error(e.message);
    }
}
test();

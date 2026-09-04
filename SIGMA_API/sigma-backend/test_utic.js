const axios = require('axios');
const xml2js = require('xml2js');

async function testUtic(regionCode) {
    const url = `http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?type=xml&srchCTId=${regionCode}`;
    try {
        console.log(`Fetching ${regionCode}...`);
        const res = await axios.get(url, { timeout: 10000 });
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(res.data);
        
        const items = result.response?.body?.items?.item;
        if (!items) {
            console.log(`${regionCode}: No items found in response.`);
        } else if (Array.isArray(items)) {
            console.log(`${regionCode}: ${items.length} intersections found.`);
        } else {
            console.log(`${regionCode}: 1 intersection found.`);
        }
    } catch (e) {
        console.error(`${regionCode} error:`, e.message);
    }
}

async function run() {
    await testUtic('L01'); // Seoul
    await testUtic('L02'); // Incheon
    await testUtic('L29'); // Daegu
    await testUtic('L30'); // Daejeon
    await testUtic('L31'); // Gwangju
    await testUtic('L37'); // Pohang
}

run();

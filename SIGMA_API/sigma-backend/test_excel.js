const axios = require('axios');
const xlsx = require('xlsx');

const UTIC_API_KEY = '5a4d6f4b-70c3-4a1b-a590-bdf14d014902'; // I'll use a generic one or extract it from .env if needed, let's load dotenv

require('dotenv').config();
const key = process.env.UTIC_API_KEY || '5a4d6f4b-70c3-4a1b-a590-bdf14d014902';

async function test(regionCode) {
    const apiRegion = regionCode === 'L01' ? '110' : regionCode;
    const excelUrl = `http://tsihub.utic.go.kr/tsi/api/CrossRoadInfoService/download/crossInfo?serviceKey=${key}&srchCTId=${apiRegion}`;
    
    try {
        console.log(`Fetching Excel for ${regionCode} (${apiRegion})...`);
        const res = await axios.get(excelUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const workbook = xlsx.read(res.data, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawItems = xlsx.utils.sheet_to_json(sheet);
        console.log(`Region ${regionCode}: ${rawItems.length} items found in Excel.`);
    } catch (e) {
        if (e.response) {
            console.error(`Region ${regionCode}: HTTP ${e.response.status}`);
        } else {
            console.error(`Region ${regionCode} error:`, e.message);
        }
    }
}

async function run() {
    await test('L01');
    await test('L02');
    await test('L29'); // Daegu
    await test('L30'); // Daejeon
}
run();

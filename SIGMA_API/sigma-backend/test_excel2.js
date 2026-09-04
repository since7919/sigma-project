const axios = require('axios');
const xlsx = require('xlsx');

require('dotenv').config();
const key = process.env.UTIC_API_KEY || '5a4d6f4b-70c3-4a1b-a590-bdf14d014902';

async function test(regionCode) {
    const apiRegion = regionCode === 'L01' ? '110' : regionCode;
    const excelUrl = `http://tsihub.utic.go.kr/tsi/api/CrossRoadInfoService/download/crossInfo?serviceKey=${key}&srchCTId=${apiRegion}`;
    
    try {
        const res = await axios.get(excelUrl, { responseType: 'arraybuffer' });
        const workbook = xlsx.read(res.data, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawItems = xlsx.utils.sheet_to_json(sheet);
        console.log(`Region ${regionCode} first item:`, rawItems[0]);
    } catch (e) {
        console.error(e.message);
    }
}

test('L02');

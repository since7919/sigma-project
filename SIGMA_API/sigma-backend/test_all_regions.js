const axios = require('axios');
const xlsx = require('xlsx');

require('dotenv').config();
const key = process.env.UTIC_API_KEY || '5a4d6f4b-70c3-4a1b-a590-bdf14d014902';

const REGION_MAP = {
  'L01': '서울시', 'L02': '인천시', 'L03': '평택시', 'L04': '안성시',
  'L05': '과천시', 'L06': '부천시', 'L07': '광명시', 'L08': '안산시',
  'L09': '파주시', 'L10': '오산시', 'L11': '화성시', 'L12': '동두천시',
  'L13': '양주시', 'L14': '의정부시', 'L15': '김포시', 'L16': '의왕시',
  'L17': '군포시', 'L18': '남양주시', 'L19': '수원시', 'L20': '광주시',
  'L21': '구리시', 'L22': '하남시', 'L23': '부산시', 'L24': '양산시',
  'L25': '창원시', 'L26': '김해시', 'L28': '거제시', 'L29': '대구시',
  'L30': '대전시', 'L31': '광주광역시', 'L37': '포항시'
};

async function testAll() {
    for (const regionCode of Object.keys(REGION_MAP)) {
        const apiRegion = regionCode === 'L01' ? '110' : regionCode;
        const excelUrl = `http://tsihub.utic.go.kr/tsi/api/CrossRoadInfoService/download/crossInfo?serviceKey=${key}&srchCTId=${apiRegion}`;
        
        try {
            const res = await axios.get(excelUrl, { responseType: 'arraybuffer', timeout: 5000 });
            const workbook = xlsx.read(res.data, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawItems = xlsx.utils.sheet_to_json(sheet);
            console.log(`${regionCode} (${REGION_MAP[regionCode]}): ${rawItems.length} items`);
        } catch (e) {
            if (e.response) {
                console.log(`${regionCode} (${REGION_MAP[regionCode]}): HTTP ${e.response.status}`);
            } else {
                console.log(`${regionCode} (${REGION_MAP[regionCode]}): Error ${e.message}`);
            }
        }
    }
}

testAll();

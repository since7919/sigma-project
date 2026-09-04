const axios = require('axios');
const serviceKey = '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';
const sggCds = ['11500', '11530', '11545', '11560', '11590', '11620', '11650', '11680', '11710', '11740'];
async function test() {
    for (const sggCd of sggCds) {
        const url = `https://apis.data.go.kr/1320000/safetyzonedtlinfo/getdtllist?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&type=json&sggCd=${sggCd}`;
        try {
            const res = await axios.get(url);
            const data = res.data;
            if (data && data.response && data.response.body && data.response.body.items) {
                const items = data.response.body.items.item || data.response.body.items;
                console.log(sggCd, 'items length:', Array.isArray(items) ? items.length : 1);
            } else {
                console.log(sggCd, 'no items');
            }
        } catch (e) { console.error(e.message); }
    }
}
test();

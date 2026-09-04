const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const rtiEndpoints = `
// ==========================================
// [RTI] 행정안전부 전국지자체 실시간 신호정보 API 연동
// ==========================================
app.get('/api/rti/intersections', async (req, res) => {
  const { stdgCd } = req.query;
  if (!stdgCd) return res.status(400).json({ error: 'stdgCd is required' });
  
  const serviceKey = process.env.RTI_API_KEY || process.env.UTIC_API_KEY || '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';
  const url = \`https://apis.data.go.kr/B551962/rti/crsrd_map_info?serviceKey=\${serviceKey}&pageNo=1&numOfRows=999&type=json&stdgCd=\${stdgCd}\`;
  
  try {
    const response = await axios.get(url, { timeout: 15000 });
    // 공공데이터포털 에러 응답 처리
    if (response.data?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg) {
      throw new Error(response.data.OpenAPI_ServiceResponse.cmmMsgHeader.returnAuthMsg);
    }
    
    let items = response.data?.response?.body?.items?.item || response.data?.body?.items?.item || [];
    if (!Array.isArray(items)) items = [items];
    
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    const msg = error.response ? \`HTTP \${error.response.status}\` : error.message;
    console.error('[RTI API Error]', msg);
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/rti/signals', async (req, res) => {
  const { stdgCd } = req.query;
  if (!stdgCd) return res.status(400).json({ error: 'stdgCd is required' });
  
  const serviceKey = process.env.RTI_API_KEY || process.env.UTIC_API_KEY || '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698';
  const url = \`https://apis.data.go.kr/B551962/rti/tl_drct_info?serviceKey=\${serviceKey}&pageNo=1&numOfRows=9999&type=json&stdgCd=\${stdgCd}\`;
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    if (response.data?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg) {
      throw new Error(response.data.OpenAPI_ServiceResponse.cmmMsgHeader.returnAuthMsg);
    }
    
    let items = response.data?.response?.body?.items?.item || response.data?.body?.items?.item || [];
    if (!Array.isArray(items)) items = [items];
    
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    const msg = error.response ? \`HTTP \${error.response.status}\` : error.message;
    res.status(500).json({ success: false, error: msg });
  }
});
`;

if (!appJs.includes('/api/rti/intersections')) {
    appJs = appJs.replace('// 1-1. 교차로 마스터 데이터 수동 갱신 (UTIC -> DB)', rtiEndpoints + '\n// 1-1. 교차로 마스터 데이터 수동 갱신 (UTIC -> DB)');
    fs.writeFileSync('app.js', appJs, 'utf8');
    console.log('Added RTI endpoints to app.js');
} else {
    console.log('RTI endpoints already exist');
}

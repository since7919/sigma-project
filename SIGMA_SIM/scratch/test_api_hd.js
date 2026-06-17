async function test() {
    const srchCTId = 'L02';
    const srchCRNm = encodeURIComponent('신광4거리');
    
    // 3. Plan Header Info
    const planHdUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRHDInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&srchCTId=${srchCTId}&srchCRNm=${srchCRNm}&type=json`;
    try {
        let r3 = await fetch(planHdUrl);
        let d3 = await r3.json();
        console.log("=== PLAN HD ===");
        console.log(JSON.stringify(d3.slice(0, 3), null, 2));
    } catch(e) { console.error(e); }
}
test();

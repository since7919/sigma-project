async function test() {
    const srchCTId = 'L02';
    const srchCRNm = encodeURIComponent('신광4거리');
    
    // 4. Plan Body Info
    const planBdUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRBDInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&srchCTId=${srchCTId}&srchCRNm=${srchCRNm}&type=json`;
    try {
        let r4 = await fetch(planBdUrl);
        let d4 = await r4.json();
        console.log("=== PLAN BD ===");
        console.log(JSON.stringify(d4.slice(0, 3), null, 2));
    } catch(e) { console.error(e); }
}
test();

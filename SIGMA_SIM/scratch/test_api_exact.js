async function test() {
    const srchCTId = 'L02';
    const srchCRNm = encodeURIComponent('신광4거리');
    
    // 1. SigMap Info
    const sigMapUrl = `http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&srchCTId=${srchCTId}&srchCRNm=${srchCRNm}&type=json`;
    try {
        let r1 = await fetch(sigMapUrl);
        let d1 = await r1.json();
        console.log("=== SIGMAP ===");
        console.log(JSON.stringify(d1.slice(0, 3), null, 2));
    } catch(e) { console.error(e); }

    // 2. Plan Info
    const planUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&srchCTId=${srchCTId}&srchCRNm=${srchCRNm}&type=json`;
    try {
        let r2 = await fetch(planUrl);
        let d2 = await r2.json();
        console.log("=== PLAN ===");
        console.log(JSON.stringify(d2.slice(0, 3), null, 2));
    } catch(e) { console.error(e); }
}
test();

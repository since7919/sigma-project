async function test() {
    const planBdUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRBDInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&srchCTId=L02&srchCRNm=${encodeURIComponent('신광4거리')}&type=json`;
    try {
        let r = await fetch(planBdUrl);
        let t = await r.text();
        console.log("=== PLAN BD ===");
        console.log(t.substring(0, 1000));
    } catch(e) { console.error(e); }
}
test();

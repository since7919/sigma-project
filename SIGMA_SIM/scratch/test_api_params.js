async function testParams() {
    const base = "http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&regionCode=L02&type=json&";
    const params = ["itstId=1001", "intNo=1001", "itstNm=신광4거리", "crsrdNo=1001", "nodeId=1610000900", "intNo=L02000001001"];
    
    for (const p of params) {
        const url = base + p;
        try {
            const res = await fetch(url);
            const data = await res.json();
            const firstItem = data[1] || {};
            console.log(`Param: ${p} -> returned INT_NM: ${firstItem.INT_NM}`);
        } catch (e) {
            console.log(`Param: ${p} -> Error`);
        }
    }
}
testParams();

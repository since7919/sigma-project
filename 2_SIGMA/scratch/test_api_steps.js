async function test() {
    const srchCTId = 'L02';
    const srchCRNm = encodeURIComponent('신광4거리');
    const sigMapUrl = `http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&srchCTId=${srchCTId}&srchCRNm=${srchCRNm}&type=json`;
    try {
        let r1 = await fetch(sigMapUrl);
        let d1 = await r1.json();
        console.log("=== SIGMAP ===");
        // Print all steps to see if MIN_TM adds up to a cycle
        d1.slice(1).forEach(item => {
            console.log(`STEP_NO: ${item.STEP_NO}, MIN_TM: ${item.MIN_TM}`);
        });
    } catch(e) { console.error(e); }
}
test();

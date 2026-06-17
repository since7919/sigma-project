const fetchUrl1 = "http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&regionCode=L02&itstNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&type=json";
const fetchUrl2 = "http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&regionCode=L02&itstNm=%EC%8B%A0%EA%B4%914%EA%B1%B0%EB%A6%AC&type=json";

async function fetchInfo() {
    try {
        let res1 = await fetch(fetchUrl1);
        let data1 = await res1.json();
        console.log("=== PLAN INFO ===");
        console.log(JSON.stringify(data1.slice(0,2), null, 2));

        let res2 = await fetch(fetchUrl2);
        let data2 = await res2.json();
        console.log("=== SIGMAP INFO ===");
        console.log(JSON.stringify(data2.slice(0,2), null, 2));
    } catch(e) {
        console.error(e);
    }
}
fetchInfo();

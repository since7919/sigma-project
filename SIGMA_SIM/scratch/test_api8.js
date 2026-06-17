const originalUrl = "http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&regionCode=110&itstNm=%EC%84%9C%EC%9A%B8%EC%97%AD%EC%82%AC%EB%B0%95%EB%AC%BC%EA%B4%80&type=json";
const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(originalUrl);

fetch(proxyUrl)
    .then(res => { console.log(res.status); return res.text(); })
    .then(text => console.log(text.substring(0, 500)))
    .catch(err => console.error(err));

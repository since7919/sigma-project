const url = "http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&type=json";

fetch(url)
    .then(res => res.text())
    .then(text => console.log(text.substring(0, 500)))
    .catch(err => console.error(err));

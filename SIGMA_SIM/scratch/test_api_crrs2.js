const url = "http://tsihub.utic.go.kr/tsi/api/CrossRoadInfoService/getCRRSInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&regionCode=110&type=json";

fetch(url)
    .then(res => res.text())
    .then(text => console.log(text.substring(0, 500)))
    .catch(err => console.error(err));

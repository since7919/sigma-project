const url = "http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&regionCode=110&itstNm=%EC%84%9C%EC%9A%B8%EA%B4%91%EC%9E%A5&type=json";

fetch(url)
    .then(res => res.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => console.error(err));

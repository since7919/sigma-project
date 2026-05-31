const fetchUrl = "http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?serviceKey=kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI&regionCode=L02&intNo=1001&type=json";

fetch(fetchUrl)
    .then(res => res.json())
    .then(data => {
        if(Array.isArray(data)) {
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(data);
        }
    })
    .catch(console.error);

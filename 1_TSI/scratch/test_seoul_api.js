const http = require('http');
const targetUrl = 'https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseInformation/1.0?apikey=a6a8e58e-7215-4025-b453-2d33cdd09eb2';
const proxyUrl = 'http://127.0.0.1:3001/?url=' + encodeURIComponent(targetUrl);

http.get(proxyUrl, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Data length:", data.length);
        console.log("Sample:", data.substring(0, 200));
    });
}).on('error', err => console.error(err));

const http = require('http');
const https = require('https');

const SERVICE_KEY = 'kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI';
const REGION = 'L02';
const NAME = encodeURIComponent('신광4거리');

const endpoints = [
    `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?serviceKey=${SERVICE_KEY}&srchCTId=${REGION}&itstNm=${NAME}&type=xml`,
    `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRSTInfo?serviceKey=${SERVICE_KEY}&srchCTId=${REGION}&itstNm=${NAME}&type=xml`,
    `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRHDInfo?serviceKey=${SERVICE_KEY}&srchCTId=${REGION}&srchCRNm=${NAME}&type=xml`
];

function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(e));
    });
}

async function test() {
    for (const url of endpoints) {
        console.log(`Testing: ${url}`);
        try {
            const data = await fetch(url);
            console.log(`Response Length: ${data.length}`);
            console.log('Preview:', data.substring(0, 1000));
            console.log('---');
        } catch (e) {
            console.log(`Error calling ${url}: ${e.message}`);
        }
    }
}

test();

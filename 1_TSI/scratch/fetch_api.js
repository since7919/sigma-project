const https = require('https');
const fs = require('fs');

const url = 'https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingFusionInformation/1.0?apikey=a6a8e58e-7215-4025-b453-2d33cdd09eb2';

const req = https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            fs.writeFileSync('seoul_base_info.json', JSON.stringify(json, null, 2));
            console.log('Successfully saved to seoul_base_info.json. Array length:', json.length);
            if (json.length > 0) {
                console.log('Sample item:', json[0]);
            }
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
            console.log('Raw response:', data.substring(0, 500));
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e);
});

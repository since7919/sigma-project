const https = require('https');

function postData(url, data) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(data);
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: body }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function getData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: body }));
        }).on('error', reject);
    });
}

(async () => {
    try {
        console.log('Fetching initial version...');
        const v1 = await getData('https://sigma-project-245n.onrender.com/api/sim/db-version');
        console.log('Initial version:', JSON.parse(v1.data).version);

        console.log('\nSending mock update-junction...');
        const updateData = {
            jid: 'L01-9999999',
            interCsvLine: '"L01-9999999","L01","Test","37.0","127.0","9999999","","","0","","","","","-1","1;1;1;1;1;2;3"',
            mapCsvLines: '"L01-9999999","0","0;0","0;0","0;0","0;0","A0;B0","3;3","3;3","2;2","2;2","15;15","15;15","2;2","2;2","0;0","0;0","0;0","0;0","""{\\"stepsA\\":[],\\"stepsB\\":[]}"""\n',
            todCsvLines: '"L01-9999999","1","0","0","0:0;1;1;0;0;0;0;0;0;0;0;0;0;0;0;0","0:0;1;1;0;0;0;0;0;0;0;0;0;0;0;0;0","0:0;1;1;0;0;0;0;0;0;0;0;0;0;0;0;0"'
        };
        const res = await postData('https://sigma-project-245n.onrender.com/api/sim/update-junction', updateData);
        console.log('Update result:', res.status, res.data);

        console.log('\nFetching version after update (should NOT be null, should be new)...');
        const v2 = await getData('https://sigma-project-245n.onrender.com/api/sim/db-version');
        console.log('New version:', JSON.parse(v2.data).version);

        console.log('\nChecking if CDN file exists for new version...');
        const cdnRes = await getData('https://sigma-project-245n.onrender.com/api/sim/data?file=db_L01_signal_maps.csv&v=' + JSON.parse(v2.data).version);
        console.log('CDN Check Status:', cdnRes.status);
    } catch(e) {
        console.error(e);
    }
})();

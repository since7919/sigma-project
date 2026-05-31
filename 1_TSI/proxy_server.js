const http = require('http');
const https = require('https');
const url = require('url');

// 공공데이터 API 서버의 SSL 인증서 검증 오류 무시 (UTIC 인증서 문제 해결)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PORT = 3001;

const server = http.createServer((req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const query = url.parse(req.url, true).query;
    const targetUrl = query.url;

    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing "url" parameter');
        return;
    }

    console.log(`Proxying request to: ${targetUrl}`);

    const protocol = targetUrl.startsWith('https') ? https : http;

    protocol.get(targetUrl, (proxyRes) => {
        let data = '';

        res.writeHead(proxyRes.statusCode, {
            'Content-Type': proxyRes.headers['content-type'] || 'application/json'
        });

        proxyRes.on('data', (chunk) => {
            res.write(chunk);
        });

        proxyRes.on('end', () => {
            res.end();
        });

    }).on('error', (err) => {
        console.error('Proxy Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Proxy Error: ${err.message}`);
    });
});

server.listen(PORT, () => {
    console.log(`CORS Proxy Server running at http://localhost:${PORT}`);
    console.log(`Usage: http://localhost:${PORT}/proxy?url=TARGET_URL`);
});

const http = require('http');

const PORT = 3001;

const server = http.createServer(async (req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url.startsWith('/proxy?url=')) {
        const targetUrl = decodeURIComponent(req.url.split('url=')[1]);
        
        try {
            console.log(`[Proxy] Requesting: ${targetUrl}`);
            const apiRes = await fetch(targetUrl);
            const data = await apiRes.json();
            
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(data));
        } catch (error) {
            console.error('[Proxy Error]', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Proxy failed', details: error.message }));
        }
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`✅ SIGMA Local API Proxy Server running at http://localhost:${PORT}`);
    console.log(`   Waiting for API requests from dashboard...`);
});

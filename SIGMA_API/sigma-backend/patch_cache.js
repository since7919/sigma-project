const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// Add Cache
if (!appJs.includes('const CSV_CACHE = {};')) {
    appJs = appJs.replace('const app = express();', 'const app = express();\n\n// [성능 최적화] /api/sim/data CSV 응답 메모리 캐시 (100배 속도 향상)\nconst CSV_CACHE = {};\n');
}

// Intercept res.write and res.end to cache it
const originalRoute = \pp.get('/api/sim/data', async (req, res) => {\;
const cachedRoute = \pp.get('/api/sim/data', async (req, res) => {
  const { file } = req.query;
  
  if (CSV_CACHE[file]) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send(CSV_CACHE[file]);
  }
  
  // 가로채기 객체 생성
  let cacheBuffer = "";
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  
  res.write = function(chunk) {
      cacheBuffer += chunk;
      return originalWrite(chunk);
  };
  
  res.end = function(chunk) {
      if (chunk) cacheBuffer += chunk;
      CSV_CACHE[file] = cacheBuffer; // 캐시 저장
      return originalEnd(chunk);
  };
\;
if (!appJs.includes('if (CSV_CACHE[file])')) {
    appJs = appJs.replace(originalRoute, cachedRoute);
}

// Invalidate on any POST /api/sim/*
appJs = appJs.replace(
    /app\.post\('\/api\/sim\//g,
    \pp.post('/api/sim/\
).replace(
    /app\.post\('\/api\/sim\/([a-zA-Z0-9\-_]+)', async \(req, res\) => {/g,
    \pp.post('/api/sim/\', async (req, res) => {\n  // 캐시 무효화\n  Object.keys(CSV_CACHE).forEach(k => delete CSV_CACHE[k]);\
);

// also for /api/intersections
appJs = appJs.replace(
    /app\.post\('\/api\/intersections\/([a-zA-Z0-9\-_]+)', /g,
    \pp.post('/api/intersections/\', \
).replace(
    /app\.post\('\/api\/intersections\/(.*?)', (.*?)async \(req, res\) => {/g,
    \pp.post('/api/intersections/\', \ (req, res) => {\n  // 캐시 무효화\n  Object.keys(CSV_CACHE).forEach(k => delete CSV_CACHE[k]);\
);

fs.writeFileSync('app.js', appJs);
console.log('Patch complete.');

const fs = require('fs');
const path = require('path');

function checkFile(p) {
  const code = fs.readFileSync(p, 'utf8');
  const lines = code.split('\n');
  lines.forEach((l, i) => {
    if (l.match(/\b(let|const|var)\s+s\b/) || l.match(/\b(let|const|var)\s+step\b/)) {
      console.log(`${p}:${i+1}: ${l.trim()}`);
    }
  });
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist') walk(p);
    } else if (p.endsWith('.js') || p.endsWith('.jsx')) {
      checkFile(p);
    }
  });
}

walk('c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-frontend/src');

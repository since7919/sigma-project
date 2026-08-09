const fs = require('fs');

const file = 'c:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_API/sigma-backend/app.js';
let code = fs.readFileSync(file, 'utf8');
const lines = code.split(/\r?\n/);

const newLines = [
  "app.use('/realtime', express.static(path.join(__dirname, '../sigma-frontend/dist'), {",
  "  setHeaders: (res, filePath) => {",
  "    if (filePath.endsWith('.html')) {",
  "      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');",
  "      res.setHeader('Pragma', 'no-cache');",
  "      res.setHeader('Expires', '0');",
  "    }",
  "  }",
  "}));",
  "const sendIndexHtml = (req, res) => {",
  "  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');",
  "  res.setHeader('Pragma', 'no-cache');",
  "  res.setHeader('Expires', '0');",
  "  res.sendFile(path.join(__dirname, '../sigma-frontend/dist/index.html'));",
  "};",
  "app.get('/realtime', sendIndexHtml);",
  "app.get(/^\\/realtime\\/.*/, sendIndexHtml);"
];

lines.splice(23, 7, ...newLines);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('App.js updated successfully!');

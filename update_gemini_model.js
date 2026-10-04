const fs = require('fs');
let appJs = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

if (appJs.includes('gemini-2.5-flash')) {
    appJs = appJs.replace('gemini-2.5-flash', 'gemini-3.8-flash');
    fs.writeFileSync('SIGMA_API/sigma-backend/app.js', appJs, 'utf8');
    console.log('Model updated to gemini-3.8-flash');
} else {
    console.log('Model string not found in app.js');
}

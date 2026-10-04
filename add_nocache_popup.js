const fs = require('fs');

let html = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

const metaTags = `
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
`;

if (!html.includes('must-revalidate')) {
    html = html.replace('<head>', '<head>\n' + metaTags);
    fs.writeFileSync('SIGMA_SIM/tsd_popup.html', html, 'utf8');
    console.log('Added no-cache meta tags to tsd_popup.html');
}

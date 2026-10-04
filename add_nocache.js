const fs = require('fs');

let indexHtml = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const metaTags = `
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
`;

if (!indexHtml.includes('must-revalidate')) {
    indexHtml = indexHtml.replace('<head>', '<head>\n' + metaTags);
    fs.writeFileSync('SIGMA_SIM/index.html', indexHtml, 'utf8');
    console.log("Added no-cache meta tags to index.html");
} else {
    console.log("Meta tags already present.");
}

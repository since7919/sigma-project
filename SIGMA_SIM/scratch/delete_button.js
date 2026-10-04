const fs = require('fs');
let html = fs.readFileSync('../index.html', 'utf8');

const targetRegex = /<button[^>]*onclick="syncAllOptFromSignals\(\)"[^>]*>[\s\S]*?전체 교차로 일괄 현시 설정[\s\S]*?<\/button>/;
if (targetRegex.test(html)) {
    html = html.replace(targetRegex, '');
    fs.writeFileSync('../index.html', html);
    console.log('Successfully deleted the button.');
} else {
    console.log('Button not found.');
}

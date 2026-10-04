const fs = require('fs');
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const targetIdStr = '<div id="info-mov-combined-container" style="display:none; margin-top:15px;" class="sigma-panel">';
const endIdStr = '<!-- [추가] 미니게임 호출 배너 -->';

const startIndex = html.indexOf(targetIdStr);
const endIndex = html.indexOf(endIdStr);

if (startIndex !== -1 && endIndex !== -1) {
    const sectionToMove = html.substring(startIndex, endIndex);
    
    // Remove it from current location
    html = html.replace(sectionToMove, '');
    
    // Insert it before <!-- 2. [교차로 데이터] -->
    const insertPoint = html.indexOf('<!-- 2. [교차로 데이터] -->');
    if (insertPoint !== -1) {
        html = html.substring(0, insertPoint) + sectionToMove + '\\n            ' + html.substring(insertPoint);
        fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
        console.log("Moved successfully.");
    } else {
        console.log("Insert point not found.");
    }
} else {
    console.log("Target section not found.");
}

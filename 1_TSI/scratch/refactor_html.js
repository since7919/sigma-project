const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const overlayStart = html.indexOf('<div id="detail-overlay"');
const overlayEnd = html.indexOf('</main>');

if (overlayStart !== -1 && overlayEnd !== -1) {
    const containerStart = html.indexOf('<div class="detail-container glass">', overlayStart);
    // Find matching closing div for containerStart
    let depth = 0;
    let i = containerStart;
    let containerEnd = -1;
    while (i < overlayEnd) {
        if (html.startsWith('<div', i)) depth++;
        if (html.startsWith('</div', i)) {
            depth--;
            if (depth === 0) {
                containerEnd = i + 6;
                break;
            }
        }
        i++;
    }

    if (containerEnd !== -1) {
        let containerHtml = html.substring(containerStart, containerEnd);
        let contentHtml = containerHtml.substring(containerHtml.indexOf('>') + 1, containerHtml.lastIndexOf('</div>'));
        
        // Use a generic regex to safely replace IDs
        let html1 = contentHtml.replace(/id="([^"]+)"/g, 'id="$1-1"');
        let html2 = contentHtml.replace(/id="([^"]+)"/g, 'id="$1-2"');
        
        let newOverlayHtml = 
            '<div class="detail-container glass" id="detail-container-1" style="width: 49%; height: 95%; overflow: hidden;">\n' + 
            html1 + 
            '\n</div>\n' + 
            '<div class="detail-container glass" id="detail-container-2" style="width: 49%; height: 95%; overflow: hidden; display: none; position: relative;">\n' + 
            '   <button id="close-slot-2" style="position:absolute; top:20px; right:20px; background:rgba(255,0,0,0.5); color:white; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; z-index:1000; font-weight:bold;">X</button>\n' +
            html2 + 
            '\n</div>';
            
        html = html.substring(0, containerStart) + newOverlayHtml + html.substring(containerEnd);
        
        // Update overlay style for dual view
        html = html.replace(
            '<div id="detail-overlay" class="overlay hidden">', 
            '<div id="detail-overlay" class="overlay hidden" style="display:flex; flex-direction:row; gap:1%; align-items:center; justify-content:center; padding: 1%; box-sizing: border-box;">'
        );
        
        fs.writeFileSync('index.html', html);
        console.log('index.html successfully updated for dual view!');
    } else {
        console.error('Could not find end of detail-container');
    }
} else {
    console.error('Could not find detail-overlay bounds');
}

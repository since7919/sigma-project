const fs = require('fs');

let js = fs.readFileSync('../js/minigame.js', 'utf8');

// Revert internal buffer to 360x200
js = js.replace(/width="720" height="400"/g, 'width="360" height="200"');

// Ensure CSS width/height are applied for 2x scaling
if (!js.includes('width: 720px; height: 400px;')) {
    js = js.replace(/style="background: #111;/g, 'style="width: 720px; height: 400px; background: #111;');
}

fs.writeFileSync('../js/minigame.js', js);
console.log('Fixed canvas scaling via CSS');

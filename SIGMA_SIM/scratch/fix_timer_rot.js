const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

content = content.replace(
    /<div id="timer-\$\{jid\}-\$\{m\}-\$\{idx\}" class="signal-timer" style="display:none;"><\/div>/g,
    '<div id="timer-${jid}-${m}-${idx}" class="signal-timer" style="display:none; transform: translateX(-50%) rotate(${-currentRot}deg);"></div>'
);

content = content.replace(
    /<div id="timer-overlay-\$\{jid\}-\$\{m\}-\$\{idx\}" class="signal-timer" style="display:none;"><\/div>/g,
    '<div id="timer-overlay-${jid}-${m}-${idx}" class="signal-timer" style="display:none; transform: translateX(-50%) rotate(${-currentRot}deg);"></div>'
);

fs.writeFileSync('SIGMA_SIM/js/junction_map.js', content, 'utf8');
console.log('Fixed junction_map.js timer rotation');

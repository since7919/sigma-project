const fs = require('fs');
const path = '../js/junction_optimizer.js';
let js = fs.readFileSync(path, 'utf8');

// 1. Restore 8 directions loop
js = js.replace(
    /OPT_DIRS\.slice\(0, 4\)\.forEach\(d => \{/g,
    'OPT_DIRS.forEach(d => {'
);

// 2. Modify theadRow2 column widths
js = js.replace(
    /<th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:70px; min-width:70px; font-weight:normal; background:rgba\(255,255,255,0\.02\);">버스<\/th>/g,
    '<th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:56px; min-width:56px; font-weight:normal; background:rgba(255,255,255,0.02);">버스</th>'
);
js = js.replace(
    /<th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:70px; min-width:70px; font-weight:normal; background:rgba\(255,255,255,0\.02\);">좌회전<\/th>/g,
    '<th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:56px; min-width:56px; font-weight:normal; background:rgba(255,255,255,0.02);">좌회전</th>'
);
js = js.replace(
    /<th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:70px; min-width:70px; font-weight:normal; background:rgba\(255,255,255,0\.02\);">직진<\/th>/g,
    '<th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:56px; min-width:56px; font-weight:normal; background:rgba(255,255,255,0.02);">직진</th>'
);
js = js.replace(
    /<th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:70px; min-width:70px; font-weight:normal; background:rgba\(255,255,255,0\.02\);">우회전<\/th>/g,
    '<th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:56px; min-width:56px; font-weight:normal; background:rgba(255,255,255,0.02);">우회전</th>'
);

// 3. Update table min-width
js = js.replace(
    /table-layout:fixed; min-width:980px;/g,
    'table-layout:fixed; width:1872px;'
);

fs.writeFileSync(path, js);
console.log('Restored 8 directions and adjusted layout width');

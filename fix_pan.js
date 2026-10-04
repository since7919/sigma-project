const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

c = c.replace(
    /if \(targetMap && targetMap\.dragging\) \{\s*targetMap\.dragging\.disable\(\);\s*\}/g,
    '// overlayMap is static, no need to disable dragging'
);

c = c.replace(
    /if \(targetMap && targetMap\.dragging\) \{\s*targetMap\.dragging\.enable\(\);\s*\}/g,
    '// overlayMap is static, do not re-enable dragging'
);

fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c, 'utf8');

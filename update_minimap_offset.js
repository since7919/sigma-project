const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

c = c.replace(
    /renderConfigs\.forEach\(\(config, idx\) => \{\s*const pos = \[j\.lat \+ config\.dLat, j\.lng \+ config\.dLng\];/,
    `renderConfigs.forEach((config, idx) => {
                // [개선] 상세보기 미니맵에서는 지도 배율이 고정되어 있어 화살표가 겹치므로, 
                // 시각적 가독성을 위해 중심점으로부터의 거리를 2.5배 띄워서 렌더링합니다.
                const multi = 2.5; 
                const pos = [j.lat + config.dLat * multi, j.lng + config.dLng * multi];`
);

fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c, 'utf8');
console.log("junction_map.js updated.");

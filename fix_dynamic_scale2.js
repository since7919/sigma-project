const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

const regex = /renderConfigs\.forEach\(\(config, idx\) => \{\s*const pos = \[j\.lat \+ config\.dLat, j\.lng \+ config\.dLng\];/;

const match = c.match(regex);
if(match) {
    const replaced = `renderConfigs.forEach((config, idx) => {
                // 메인 맵의 줌 레벨과 상세보기(18)의 차이를 계산하여 거리를 보정 (시각적 픽셀 거리 일치)
                const currentMapZoom = (typeof window.map !== 'undefined') ? window.map.getZoom() : 18;
                const scaleFactor = Math.pow(2, currentMapZoom - 18);
                const pos = [j.lat + config.dLat * scaleFactor, j.lng + config.dLng * scaleFactor];`;
    c = c.replace(match[0], replaced);
    fs.writeFileSync('SIGMA_SIM/js/junction_map.js', c, 'utf8');
    console.log("junction_map.js overlay dynamic scale fixed.");
} else {
    console.log("Could not find regex match.");
}

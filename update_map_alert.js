const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/map.js', 'utf8');

const regex = /AppStateMachine\.setMode\(CONFIG\.APP_MODE\.MAP_EDIT\);\s*alert\("교차로 및 신호등 위치 편집 모드가 활성화되었습니다\.\\n" \+\s*"1\. \[우클릭\+드래그\] : 모든 신호등의 회전\\n" \+\s*"2\. \[좌클릭\+드래그\] : 신호등 위치 이동\\n" \+\s*"3\. \[Ctrl\+왼클릭\]  : 신호등 복사\\n" \+\s*"4\. \[더블클릭\+우클릭 드래그\]: 개별 신호등 회전"\);/;

const newStr = `AppStateMachine.setMode(CONFIG.APP_MODE.MAP_EDIT);`;

c = c.replace(regex, newStr);

fs.writeFileSync('SIGMA_SIM/js/map.js', c, 'utf8');
console.log("map.js updated.");

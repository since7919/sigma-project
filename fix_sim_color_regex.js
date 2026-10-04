const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/simulation.js', 'utf8');

const regex = /const stateObj = activeStates\[m\] \|\| \{ st: 'R', rem: 0 \};\s*const st = stateObj\.st;\s*const rem = stateObj\.rem;\s*const walk = m >= 100 \? 'walk-mode' : '';\s*\/\/\s*클래스 업데이트 \(성능을 위해 변경 시에만\)\s*if \(cache\.lastState !== st\)/;

const newStr = `const stateObj = activeStates[m] || { st: 'R', rem: 0 };
            let st = stateObj.st;
            const rem = stateObj.rem;
            const walk = m >= 100 ? 'walk-mode' : '';
            
            // [편집 모드 고정] 맵 편집 모드에서는 시뮬레이션(애니메이션) 색상 변경을 중지하고, 
            // 현재 교차로 시차맵에 등록된 화살표(이동류)는 항상 녹색(G), 미등록 화살표는 적색(R)으로 고정하여 보여줍니다.
            if (editing) {
                const mapMovs = [...(activeMap.movA || []), ...(activeMap.movB || []), ...(activeMap.pedMovA || []), ...(activeMap.pedMovB || [])].map(Number);
                st = mapMovs.includes(m) ? 'G' : 'R';
            }
            
            // 클래스 업데이트 (성능을 위해 변경 시에만)
            if (cache.lastState !== st)`;

c = c.replace(regex, newStr);

fs.writeFileSync('SIGMA_SIM/js/simulation.js', c, 'utf8');
console.log("Regex replaced.");

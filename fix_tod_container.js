const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// handlePhaseTodDragStart 에서 컨테이너 찾기 수정
const s1 = p.indexOf("window.handlePhaseTodDragStart = function");
const e1 = p.indexOf("};", s1);
if (s1 !== -1 && e1 !== -1) {
    let func = p.substring(s1, e1 + 2);
    func = func.replace(/tod-summary-container/g, 'tod-plan-info-container');
    p = p.substring(0, s1) + func + p.substring(e1 + 2);
}

// initPhaseTodDnD 에서 컨테이너 찾기 수정
const s2 = p.indexOf("(function initPhaseTodDnD() {");
const e2 = p.lastIndexOf("})();");
if (s2 !== -1 && e2 !== -1) {
    let func2 = p.substring(s2, e2 + 5);
    func2 = func2.replace(/tod-summary-container/g, 'tod-plan-info-container');
    p = p.substring(0, s2) + func2 + p.substring(e2 + 5);
}

fs.writeFileSync('SIGMA_SIM/js/phase.js', p, 'utf8');
console.log("FIXED CONTAINER ID");

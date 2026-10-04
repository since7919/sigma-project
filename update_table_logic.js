const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/table_logic.js', 'utf8');

const regexMov = /const movContainer = document\.getElementById\('mov-combined-container'\);\s*if \(movContainer && !tableEventInitialized\.mov\) \{\s*movContainer\.addEventListener\('change', \(e\) => \{\s*if \(e\.target\.dataset\.type === 'mov'\) handleMovInput\(e\.target\);\s*\}\);\s*movContainer\.addEventListener\('keydown', \(e\) => \{\s*if \(e\.target\.classList\.contains\('sigma-input'\)\) handleTableKeyNavigation\(e\);\s*\}\);\s*tableEventInitialized\.mov = true;\s*\}/;

const newMov = `const movContainer = document.getElementById('mov-combined-container');
    if (movContainer && !tableEventInitialized.mov) {
        movContainer.addEventListener('change', (e) => {
            if (e.target.dataset.type === 'mov') handleMovInput(e.target);
        });
        movContainer.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
        });
        
        // 추가: NODE/LINK 탭의 이동류 복제 테이블 이벤트 처리
        const infoMovContainer = document.getElementById('info-mov-table-wrapper');
        if (infoMovContainer) {
            infoMovContainer.addEventListener('change', (e) => {
                if (e.target.dataset.type === 'mov') handleMovInput(e.target);
            });
            infoMovContainer.addEventListener('keydown', (e) => {
                if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
            });
        }
        
        tableEventInitialized.mov = true;
    }`;

let replaced = c.replace(regexMov, newMov);
if (c !== replaced) {
    fs.writeFileSync('SIGMA_SIM/js/table_logic.js', replaced, 'utf8');
    console.log("table_logic.js updated.");
} else {
    console.log("Regex did not match in table_logic.js");
}

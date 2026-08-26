const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/junction_optimizer.js', 'utf8');

// 1. Title change
code = code.replace('📋 교차로 현시 템플릿 (Template)', '📋 교차로 기하구조');

// 2. Select styling change
code = code.replace(
    'background:#111; color:#00d4ff; border:1px solid #444;',
    'background:#333; color:#fff; border:1px solid #555;'
);

// 3. Remove dropdown reset logic
const resetLogicRegex = /\/\/ 드롭다운 리셋 \(선택 후 초기화하여 계속 선택 가능하게 함\)\r?\n\s*const sel = document\.querySelector\(`\.preset-select\[data-dir="\$\{dir\}"\]`\);\r?\n\s*if \(sel\) sel\.value = "";/g;
code = code.replace(resetLogicRegex, '// 드롭다운 선택값 유지\n    // 선택한 값을 계속 표시되도록 리셋하지 않음');

// 4. Update updateTemplatePanelUI to NOT reset the value when inactive (optional, but let's just make it disabled without clearing)
const inactiveResetRegex = /sel\.disabled = true;\r?\n\s*sel\.value = "";/g;
code = code.replace(inactiveResetRegex, 'sel.disabled = true;');

fs.writeFileSync('SIGMA_SIM/js/junction_optimizer.js', code, 'utf8');

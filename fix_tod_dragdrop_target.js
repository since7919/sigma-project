const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// 1. Make the <td> draggable
const tdSearch = `onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 2px 0; border-left: 1px solid rgba(255,255,255,0.05); background: \${bg}; cursor: pointer; position: relative;">`;
const tdReplace = `onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 2px 0; border-left: 1px solid rgba(255,255,255,0.05); background: \${bg}; cursor: grab; position: relative;" draggable="true" ondragstart="window.handlePhaseTodDragStart(event, \${idx}, \${rIdx})">`;
if (p.includes(tdSearch)) {
    p = p.replace(tdSearch, tdReplace);
}

// 2. Remove the ≡ handle div completely
const handleSearch = `<div draggable="true" ondragstart="window.handlePhaseTodDragStart(event, \${idx}, \${rIdx})" style="cursor: grab; color: #777; position: absolute; left: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; padding: 4px 2px; z-index: 10;" title="드래그하여 스케줄 복사">≡</div>`;
if (p.includes(handleSearch)) {
    p = p.replace(handleSearch, '');
} else {
    // maybe it has some other text
    const genericHandleRegex = /<div draggable="true" ondragstart="window\.handlePhaseTodDragStart\(event, \$\{idx\}, \$\{rIdx\}\)".*?>.*?<\/div>/;
    p = p.replace(genericHandleRegex, '');
}

// 3. Remove setDragImage from handlePhaseTodDragStart
const dragImageRegex = /const td = e\.target\.closest\('\.phase-tod-cell'\);\s*if \(td\) \{\s*e\.dataTransfer\.setDragImage\(td, 10, 10\);\s*\}/;
if (p.match(dragImageRegex)) {
    p = p.replace(dragImageRegex, '');
}

fs.writeFileSync('SIGMA_SIM/js/phase.js', p, 'utf8');
console.log('Made TD draggable and removed setDragImage');

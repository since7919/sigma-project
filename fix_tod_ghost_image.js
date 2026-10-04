const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const regex = /window\.handlePhaseTodDragStart\s*=\s*function\(e,\s*dayIdx,\s*slotIdx\)\s*\{[\s\S]*?e\.dataTransfer\.effectAllowed\s*=\s*'copyMove';/;

const replacement = `window.handlePhaseTodDragStart = function(e, dayIdx, slotIdx) {
    window.__DRAG_TOD = { type: 'phase-tod', dayIdx, slotIdx };
    const container = document.getElementById('tod-summary-container');
    if (container) container.classList.add('is-dragging-tod');
    e.dataTransfer.setData('text/plain', ' ');
    e.dataTransfer.effectAllowed = 'copyMove';
    
    // 강제로 깔끔한 커스텀 잔상(Drag Image) 생성하여 전체 패널이 통째로 캡처되는 브라우저 버그 방지
    let dragImg = document.getElementById('custom-tod-drag-img');
    if (!dragImg) {
        dragImg = document.createElement('div');
        dragImg.id = 'custom-tod-drag-img';
        dragImg.style.cssText = "width: 120px; height: 30px; background: rgba(0, 120, 215, 0.9); color: white; display: flex; align-items: center; justify-content: center; position: absolute; top: -1000px; left: -1000px; border-radius: 4px; font-weight: bold; font-size: 12px; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: -1;";
        dragImg.innerText = "블록 복사 중...";
        document.body.appendChild(dragImg);
    }
    e.dataTransfer.setDragImage(dragImg, 60, 15);`;

if (p.match(regex)) {
    p = p.replace(regex, replacement);
    fs.writeFileSync('SIGMA_SIM/js/phase.js', p, 'utf8');
    console.log('Fixed drag image bug');
} else {
    console.log('Regex not matched');
}

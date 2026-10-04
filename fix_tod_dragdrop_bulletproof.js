const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

// 1. Add class on dragstart
const dragStartSearch = `window.__DRAG_TOD = { type: 'phase-tod', dayIdx, slotIdx };`;
const dragStartReplace = `window.__DRAG_TOD = { type: 'phase-tod', dayIdx, slotIdx };
    const container = document.getElementById('tod-summary-container');
    if (container) container.classList.add('is-dragging-tod');`;
p = p.replace(dragStartSearch, dragStartReplace);

// 2. Add dragenter to container
const dragOverSearch = `container.addEventListener('dragover', (e) => {`;
const dragEnterAdd = `container.addEventListener('dragenter', (e) => {
            const td = e.target.closest('.phase-tod-cell');
            if (td) e.preventDefault();
        });
        
        `;
if (!p.includes(`container.addEventListener('dragenter'`)) {
    p = p.replace(dragOverSearch, dragEnterAdd + dragOverSearch);
}

// 3. Remove class on dragend
const dragEndSearch = `container.querySelectorAll('.phase-tod-cell').forEach(el => el.style.opacity = '1');`;
const dragEndReplace = `container.classList.remove('is-dragging-tod');
            container.querySelectorAll('.phase-tod-cell').forEach(el => el.style.opacity = '1');`;
p = p.replace(dragEndSearch, dragEndReplace);

// 4. Remove class on drop
const dropSearch = `container.addEventListener('drop', (e) => {
            e.preventDefault();`;
const dropReplace = `container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('is-dragging-tod');`;
p = p.replace(dropSearch, dropReplace);

// 5. Inject CSS for pointer-events
const cssInjectSearch = `container.innerHTML = html;`;
const cssInjectReplace = `if (!document.getElementById('tod-dnd-css')) {
        const style = document.createElement('style');
        style.id = 'tod-dnd-css';
        style.innerHTML = '.is-dragging-tod input { pointer-events: none !important; }';
        document.head.appendChild(style);
    }
    container.innerHTML = html;`;
if (!p.includes('tod-dnd-css')) {
    p = p.replace(cssInjectSearch, cssInjectReplace);
}

fs.writeFileSync('SIGMA_SIM/js/phase.js', p, 'utf8');
console.log('Bulletproofed Drag and Drop');

const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/group.js', 'utf8');

const oldTd1 = `<td style="text-align:center; border-right:1px solid #333; padding:0; \${unusedStyle}" class="\${activeClass}">`;
const newTd1 = `<td style="text-align:center; border-right:1px solid #333; padding:0; \${unusedStyle}" class="\${activeClass} drag-cell" data-drag-day="\${d}" data-drag-idx="\${i}" draggable="true">`;

const oldTd3 = `<td style="text-align:center; border-right:\${d === 9 ? 'none' : '1px solid #555'}; padding:0; \${unusedStyle}" class="\${activeClass}">`;
const newTd3 = `<td style="text-align:center; border-right:\${d === 9 ? 'none' : '1px solid #555'}; padding:0; \${unusedStyle}" class="\${activeClass} drag-cell" data-drag-day="\${d}" data-drag-idx="\${i}" draggable="true">`;

c = c.split(oldTd1).join(newTd1);
c = c.split(oldTd3).join(newTd3);

const dndLogic = `
    const tbody = document.getElementById('group-tod-body');
    if (tbody && !tbody.dataset.dndInit) {
        tbody.dataset.dndInit = 'true';
        
        tbody.addEventListener('dragstart', (e) => {
            const td = e.target.closest('td[data-drag-day]');
            if (!td) return;
            
            if (e.target.tagName === 'INPUT') {
                e.preventDefault();
                return;
            }
            
            const d = td.dataset.dragDay;
            const idx = td.dataset.dragIdx;
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'cell', d: parseInt(d), idx: parseInt(idx) }));
            e.dataTransfer.effectAllowed = 'copyMove';
            
            const siblingTds = tbody.querySelectorAll(\`td[data-drag-day="\${d}"][data-drag-idx="\${idx}"]\`);
            siblingTds.forEach(el => el.style.opacity = '0.5');
        });
        
        tbody.addEventListener('dragend', (e) => {
            const td = e.target.closest('td[data-drag-day]');
            if (!td) return;
            const d = td.dataset.dragDay;
            const idx = td.dataset.dragIdx;
            const siblingTds = tbody.querySelectorAll(\`td[data-drag-day="\${d}"][data-drag-idx="\${idx}"]\`);
            siblingTds.forEach(el => el.style.opacity = '1');
            
            tbody.querySelectorAll('.drag-hover').forEach(el => {
                el.classList.remove('drag-hover');
                el.style.backgroundColor = '';
            });
        });
        
        tbody.addEventListener('dragover', (e) => {
            const td = e.target.closest('td[data-drag-day]');
            if (!td) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            
            const d = td.dataset.dragDay;
            const idx = td.dataset.dragIdx;
            
            tbody.querySelectorAll('.drag-hover').forEach(el => {
                el.classList.remove('drag-hover');
                el.style.backgroundColor = '';
            });
            
            const siblingTds = tbody.querySelectorAll(\`td[data-drag-day="\${d}"][data-drag-idx="\${idx}"]\`);
            siblingTds.forEach(el => {
                el.classList.add('drag-hover');
                el.style.backgroundColor = 'rgba(0, 160, 255, 0.3)';
            });
        });
        
        tbody.addEventListener('dragleave', (e) => {
            const td = e.target.closest('td[data-drag-day]');
            if (!td) return;
            const d = td.dataset.dragDay;
            const idx = td.dataset.dragIdx;
            const siblingTds = tbody.querySelectorAll(\`td[data-drag-day="\${d}"][data-drag-idx="\${idx}"]\`);
            siblingTds.forEach(el => {
                el.classList.remove('drag-hover');
                el.style.backgroundColor = '';
            });
        });
        
        tbody.addEventListener('drop', (e) => {
            e.preventDefault();
            const td = e.target.closest('td[data-drag-day]');
            if (!td) return;
            
            tbody.querySelectorAll('.drag-hover').forEach(el => {
                el.classList.remove('drag-hover');
                el.style.backgroundColor = '';
            });
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.type === 'cell') {
                    const srcD = data.d;
                    const srcIdx = data.idx;
                    const tgtD = parseInt(td.dataset.dragDay);
                    const tgtIdx = parseInt(td.dataset.dragIdx);
                    
                    if (srcD === tgtD && srcIdx === tgtIdx) return;
                    
                    const group = STATE.groups[currentEditingGroup];
                    if (group && group.schedules && group.schedules[srcD] && group.schedules[tgtD]) {
                        group.schedules[tgtD][tgtIdx] = JSON.parse(JSON.stringify(group.schedules[srcD][srcIdx]));
                        
                        if (STATE.activeJid && STATE.junctions[STATE.activeJid]) {
                            const j = STATE.junctions[STATE.activeJid];
                            if (String(j.group) === String(currentEditingGroup)) {
                                j.schedules[tgtD][tgtIdx] = JSON.parse(JSON.stringify(group.schedules[srcD][srcIdx]));
                            }
                        }
                        
                        renderGroupTODTable();
                        debounceUpdateHeavyUI();
                    }
                }
            } catch (err) {
                // Not a cell drop (maybe day plan drop)
            }
        });
    }
`;

// Inject into renderGroupTODTable at the end
c = c.replace("document.getElementById('group-tod-body').innerHTML = html;", "document.getElementById('group-tod-body').innerHTML = html;\n" + dndLogic);

fs.writeFileSync('SIGMA_SIM/js/group.js', c, 'utf8');

const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/group.js', 'utf8');

const oldCode = `for (let s = 0; s < 16; s++) {
                                if (groupSchedules[d][s] && groupSchedules[d][s].cycle) {
                                    j.dayPlans[d][s].cycle = groupSchedules[d][s].cycle;
                                }`;

const newCode = `for (let s = 0; s < 16; s++) {
                                const schedItem = groupSchedules[d][s];
                                if (schedItem && schedItem.cycle && schedItem.idx > 0) {
                                    const targetIdx = schedItem.idx - 1;
                                    if (j.dayPlans[d][targetIdx]) {
                                        j.dayPlans[d][targetIdx].cycle = schedItem.cycle;
                                    }
                                }`;

c = c.replace(oldCode, newCode);

const appendCode = `
/**
 * 일계획 Drag & Drop 복사/삭제 기능
 */
function initGroupDayDragAndDrop() {
    for (let d = 0; d < 10; d++) {
        const th = document.getElementById('day-header-' + d);
        if (!th) continue;
        
        th.setAttribute('draggable', 'true');
        
        th.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', d);
            e.dataTransfer.effectAllowed = 'copyMove';
            th.style.opacity = '0.5';
        });
        
        th.addEventListener('dragend', (e) => {
            th.style.opacity = '1';
        });
        
        th.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            th.style.backgroundColor = 'rgba(0, 160, 255, 0.2)';
        });
        
        th.addEventListener('dragleave', (e) => {
            th.style.backgroundColor = '';
        });
        
        th.addEventListener('drop', (e) => {
            e.preventDefault();
            th.style.backgroundColor = '';
            
            const sourceStr = e.dataTransfer.getData('text/plain');
            if (sourceStr === 'trash') return;
            
            const sourceDay = parseInt(sourceStr);
            const targetDay = d;
            
            if (sourceDay !== targetDay && !isNaN(sourceDay) && currentEditingGroup) {
                if (confirm('일계획 ' + (sourceDay + 1) + '의 스케줄을 일계획 ' + (targetDay + 1) + '로 복사하시겠습니까?')) {
                    const group = STATE.groups[currentEditingGroup];
                    if (group && group.schedules) {
                        group.schedules[targetDay] = JSON.parse(JSON.stringify(group.schedules[sourceDay]));
                        if (STATE.activeJid && STATE.junctions[STATE.activeJid]) {
                            const j = STATE.junctions[STATE.activeJid];
                            if (String(j.group) === String(currentEditingGroup)) {
                                j.schedules[targetDay] = JSON.parse(JSON.stringify(group.schedules[sourceDay]));
                            }
                        }
                        renderGroupTODTable();
                        if (targetDay === STATE.currentGroupDayTypeIdx) debounceUpdateHeavyUI();
                    }
                }
            }
        });
        
        const headerCell = th.querySelector('.plan-header-cell');
        if (headerCell && !th.querySelector('.btn-clear-day')) {
            const clearBtn = document.createElement('i');
            clearBtn.className = 'fas fa-trash-alt btn-clear-day';
            clearBtn.style.cssText = 'margin-left: 8px; font-size: 10px; color: #ff4d4d; cursor: pointer; opacity: 0.7;';
            clearBtn.title = '일계획 초기화';
            clearBtn.onmouseover = () => clearBtn.style.opacity = '1';
            clearBtn.onmouseout = () => clearBtn.style.opacity = '0.7';
            clearBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('일계획 ' + (d + 1) + '의 스케줄을 모두 초기화(비우기) 하시겠습니까?')) {
                    if (currentEditingGroup && STATE.groups[currentEditingGroup]) {
                        const group = STATE.groups[currentEditingGroup];
                        const emptyDay = Array.from({ length: 16 }, (_, i) => ({ h: -1, m: 0, cycle: 100, idx: (i % 16) + 1 }));
                        group.schedules[d] = emptyDay;
                        
                        if (STATE.activeJid && STATE.junctions[STATE.activeJid]) {
                            const j = STATE.junctions[STATE.activeJid];
                            if (String(j.group) === String(currentEditingGroup)) {
                                j.schedules[d] = JSON.parse(JSON.stringify(emptyDay));
                            }
                        }
                        renderGroupTODTable();
                        if (d === STATE.currentGroupDayTypeIdx) debounceUpdateHeavyUI();
                    }
                }
            };
            headerCell.appendChild(clearBtn);
            headerCell.style.display = 'flex';
            headerCell.style.justifyContent = 'center';
            headerCell.style.alignItems = 'center';
        }
    }
}
`;
c = c.replace(/\r\n/g, '\n');
if(!c.includes('initGroupDayDragAndDrop')) {
    c += appendCode;
}
fs.writeFileSync('SIGMA_SIM/js/group.js', c, 'utf8');

/**
 * group.js
 * ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
 * ê·¸ë£¹ ?¸ì§‘, TOD ?Œì´ë¸? ?”ì¼ë³?ì£¼ê¸° ì°¨íŠ¸,
 * ê·¸ë£¹ ëª©ë¡, ê·¸ë£¹ CSV ?€??ë¶ˆëŸ¬?¤ê¸°
 * ?˜ì¡´: config.js, utils.js, ui.js
 */

let currentEditingGroup = null;
let selectedGroupDays = [0];
let groupCycleChart = null;

let groupHighlightMarkers = [];

/** ?œê³µ???„ë©´ ?œì„œ ?…ë°?´íŠ¸ */
function updateJunctionDiagramOrder(jid, val) {
    if (!STATE.junctions[jid]) return;
    if (!STATE.junctions[jid].extra) STATE.junctions[jid].extra = {};
    STATE.junctions[jid].extra.diagramOrder = parseInt(val);
    console.log(`[DiagramOrder] Junction ${jid} set to ${STATE.junctions[jid].extra.diagramOrder}`);

    // ?œì„œ ë³€ê²???ëª©ë¡ ?¬ì •??ë°??Œë”ë§?(ì°¨íŠ¸ ë¦¬í”„?ˆì‹œ??ë¶ˆí•„?”í•˜ë¯€ë¡?false ?„ë‹¬)
    loadGroupInfo(false);
}

/** ?œê³µ???¬í•¨ ?¬ë? ? ê? */
function toggleJunctionTsdInclusion(jid, isChecked) {
    if (!STATE.junctions[jid]) return;
    if (!STATE.junctions[jid].extra) STATE.junctions[jid].extra = {};
    
    // Checked ?íƒœë©??œì™¸ ?Œë˜ê·¸ë? falseë¡? Uncheckedë©?trueë¡??¤ì •
    STATE.junctions[jid].extra.excludeFromTsd = !isChecked;
    console.log(`[TSD Exclusion] Junction ${jid} is now ${!isChecked ? 'Excluded' : 'Included'}`);
    
    // ë¦¬ìŠ¤??ê°€?…ì„±???„í•´ ì¦‰ì‹œ ?¬ë Œ?”ë§
    loadGroupInfo(false);
}

/** [?¬ìš©???”ì²­] ?Œì† êµì°¨ë¡??œê³µ???¤ì •) ?•ë ¬ ê¸°ëŠ¥ */
function sortGroupMembers(type) {
    const gid = currentEditingGroup;
    if (!gid) return;

    let members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    // ì²´í¬??êµì°¨ë¡?excludeFromTsdê°€ trueê°€ ?„ë‹Œ ê²?ë§??€??
    let included = members.filter(j => !(j.extra && j.extra.excludeFromTsd));
    
    if (type === 'SN') {
        // S-N: ?„ë„(lat)ê°€ ??? ??(?¤ë¦„ì°¨ìˆœ)
        included.sort((a, b) => (a.lat || 0) - (b.lat || 0));
    } else if (type === 'EW') {
        // E-W: ê²½ë„(lng)ê°€ ?’ì? ??(?´ë¦¼ì°¨ìˆœ)
        included.sort((a, b) => (b.lng || 0) - (a.lng || 0));
    }
    
    // ?œì„œ ?¬ë???(1ë²ˆë???
    included.forEach((m, idx) => {
        if (!m.extra) m.extra = {};
        m.extra.diagramOrder = idx + 1;
    });
    
    // ?¤ì‹œ ?Œë”ë§?
    loadGroupInfo(false);
}

/** ?¼ê³„??ë³„ì¹­ ?…ë°?´íŠ¸ (?„ì—­ ?¸ì¶œ) */
function updatePlanAlias(dayIdx, name) {
    const gid = currentEditingGroup;
    if (!gid || !STATE.groups[gid]) return;
    if (!STATE.groups[gid].planAliases) STATE.groups[gid].planAliases = Array(10).fill("");
    STATE.groups[gid].planAliases[dayIdx] = name;
    
    // UI ì¦‰ì‹œ ê°±ì‹  (?¼ë””??ë²„íŠ¼ ëª…ì¹­ ??
    updateGroupDayUI();
}
window.updatePlanAlias = updatePlanAlias;

/** ê·¸ë£¹ ?????¨ë„ ë¦¬ì‚¬?´ì? ?¤ì • */
function initGroupTabResizer() {
    const resizer = document.getElementById('group-tab-resizer');
    const leftPanel = document.getElementById('group-detail-panel');
    const container = document.getElementById('group-tab-resizable-container');
    if (!resizer || !leftPanel || !container) return;

    let isResizing = false;
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerRect = container.getBoundingClientRect();
        const offsetX = e.clientX - containerRect.left;
        const totalWidth = containerRect.width;
        let flexLeft = offsetX / totalWidth * 2; // flex ?©ì´ 2 (1.4+0.6)
        if (flexLeft < 0.3) flexLeft = 0.3;
        if (flexLeft > 1.7) flexLeft = 1.7;
        leftPanel.style.flex = flexLeft;
        document.getElementById('group-list-panel').style.flex = 2 - flexLeft;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
        }
    });
}

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
 *  ê·¸ë£¹ ë©¤ë²„ ?˜ì´?¼ì´??(ì§€??
 * ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */




/**
 * ê·¸ë£¹ ?•ë³´ ë¡œë“œ
 * @param {boolean} refreshChart - ì°¨íŠ¸ ?¬ë Œ?”ë§ ?¬ë? (ê¸°ë³¸ true)
 */
function loadGroupInfo(refreshChart = true, targetGid = null) {
    const gidValue = targetGid !== null ? targetGid : document.getElementById('inp-edit-group-id').value;
    const gid = parseInt(gidValue);
    
    if (!gid || isNaN(gid)) return;
    currentEditingGroup = gid;
    
    // UI ID ?™ê¸°??
    const inpEdit = document.getElementById('inp-edit-group-id');
    if (inpEdit) inpEdit.value = gid;

    // ?°ì´?°ê? ?†ëŠ” ê²½ìš° ë¹??°ì´??êµ¬ì¡°?¼ë„ ?ì„± (ê°•ì œ ?Œë”ë§ì„ ?„í•´)
    if (!STATE.groups[gid]) {
        STATE.groups[gid] = {
            name: `ê·¸ë£¹ ${gid}`,
            schedules: Array.from({ length: 10 }, () => 
                Array.from({ length: 16 }, () => ({ h: -1, m: 0, cycle: 100 }))
            ),
            planAliases: ["?‰ì¼", "? ìš”??, "?¼ìš”??, "?¹ìˆ˜??, "", "", "", "", "", ""] // [New] ?¼ê³„?ë³„ ë³„ì¹­ ê¸°ë³¸ê°??¤ì •
        };
    }

    const group = STATE.groups[gid];

    // [?¬ìš©???”ì²­] ?¼ê³„??ë³„ì¹­ UI ?™ê¸°??
    autoGeneratePlanAliases(group);
    
    // [?¬ìš©??ê·œì¹™] db_groups.csv??ë³„ë„ ê´€ë¦¬ë˜ë¯€ë¡?êµì°¨ë¡??•ë³´ë¥??µí•´ ê·¸ë£¹ ?¤ì?ì¤„ì„ ?ë™?¼ë¡œ ì±„ìš°ì§€ ?ŠìŒ
    if (!group.schedules) {
        group.schedules = Array.from({ length: 10 }, () => 
            Array.from({ length: 16 }, () => ({ h: -1, m: 0, cycle: 100 }))
        );
    }

    const nameInp = document.getElementById('inp-group-name');
    if (nameInp) nameInp.value = (group.name || `ê·¸ë£¹ ${gid}`).trim();

    // 1. ?Œì´ë¸?ì¦‰ì‹œ ?Œë”ë§?(ì§€???œê°„ ?†ì´)
    renderGroupTODTable();
    renderGroupWeeklyPlanTable();

    // 2. ?Œì† êµì°¨ë¡?ëª©ë¡ ê°±ì‹ 
    // [?¬ìš©???”ì²­] êµì°¨ë¡?ëª©ë¡ ë°??œì„œ/ê±°ë¦¬ ?ë™ ê³„ì‚°
    let members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    
    // [?¬ìš©??ê·œì¹™] ?œì„œê°€ ì§€?•ë˜ì§€ ?Šì? ??ª©(-1)?¤ì— ?€???„ë„(Lat)ê°€ ??? ?œìœ¼ë¡??ë™ ?œì„œ ë¶€??
    let maxOrder = 0;
    const unorderedMembers = [];
    
    members.forEach(m => {
        let ord = (m.extra && m.extra.diagramOrder !== undefined) ? parseInt(m.extra.diagramOrder) : -1;
        if (ord > 0) {
            if (ord > maxOrder) maxOrder = ord;
        } else {
            unorderedMembers.push(m);
        }
    });

    // ?„ë„(Lat) ?¤ë¦„ì°¨ìˆœ ?•ë ¬ (?¨ìª½ -> ë¶ìª½)
    unorderedMembers.sort((a, b) => (a.lat || 0) - (b.lat || 0));

    unorderedMembers.forEach(m => {
        if (!m.extra) m.extra = {};
        maxOrder++;
        m.extra.diagramOrder = maxOrder;
    });

    // ?œì„œ?€ë¡??•ë ¬ (ì²´í¬ ?´ì œ????ª©?€ ?˜ë‹¨?¼ë¡œ, ?˜ë¨¸ì§€??ì§€?•ëœ ?œì„œ?€ë¡?
    members.sort((a, b) => {
        const aExcluded = a.extra && a.extra.excludeFromTsd === true;
        const bExcluded = b.extra && b.extra.excludeFromTsd === true;
        if (aExcluded !== bExcluded) return aExcluded ? 1 : -1;
        return (a.extra.diagramOrder || 0) - (b.extra.diagramOrder || 0);
    });

    // ê±°ë¦¬(m) ê³„ì‚°
    members.forEach((m, idx) => {
        if (idx === 0) {
            m.extra.diagramDistDisp = 0;
        } else {
            const prev = members[idx - 1];
            let autoDist = getHaversineDistance(prev.lat, prev.lng, m.lat, m.lng);
            if (isNaN(autoDist)) autoDist = 0;
            
            // ?˜ë™ ?…ë ¥ê°?diagramDist)??? íš¨???«ì?¸ì? ?•ì¸
            const manualDist = parseInt(m.extra.diagramDist);
            if (!isNaN(manualDist) && m.extra.diagramDist !== undefined && m.extra.diagramDist !== null) {
                m.extra.diagramDistDisp = manualDist;
            } else {
                m.extra.diagramDistDisp = autoDist;
            }
        }
    });

    document.getElementById('group-member-count').innerText = members.length;

    // [ê²€ì¦? ?Œì† êµì°¨ë¡œë“¤???¼ê³„??TOD) ?°ì´?°ê? ?™ì¼?œì? ?•ì¸
    const statusEl = document.getElementById('group-validation-status');
    if (statusEl) {
        if (members.length > 1) {
            statusEl.style.display = 'block';
            
            const normalize = (sched) => {
                if (!sched) return null;
                return sched.map(day => day.map(s => {
                    if (s.h === -1) return { h: -1, m: 0, cycle: 0, idx: 0 };
                    return { h: s.h, m: s.m, cycle: s.cycle, idx: s.idx };
                }));
            };
            const baseSched = JSON.stringify(normalize(members[0].schedules));
            
            let mismatchCount = 0;
            members.forEach((m, idx) => {
                const mSched = JSON.stringify(normalize(m.schedules));
                if (mSched !== baseSched) {
                    mismatchCount++;
                    m._todMismatch = true; // ?Œë˜ê·??¤ì •
                } else {
                    m._todMismatch = false;
                }
            });

            if (mismatchCount === 0) {
                statusEl.innerHTML = '??ëª¨ë“  êµì°¨ë¡??¼ê³„???¼ì¹˜';
                statusEl.style.background = 'rgba(46, 204, 113, 0.1)';
                statusEl.style.color = '#2ecc71';
                statusEl.style.borderColor = 'rgba(46, 204, 113, 0.3)';
            } else {
                statusEl.innerHTML = `? ï¸ ?¼ê³„??ë¶ˆì¼ì¹? ${mismatchCount}ê°œì†Œ`;
                statusEl.style.background = 'rgba(230, 126, 34, 0.1)';
                statusEl.style.color = '#e67e22';
                statusEl.style.borderColor = 'rgba(230, 126, 34, 0.3)';
            }
        } else {
            statusEl.style.display = 'none';
        }
    }

    highlightGroupMembers(members);

    const listContainer = document.getElementById('group-member-list');
    if (members.length === 0) {
        listContainer.innerHTML = `<div style="font-size: 10px; color: #555; text-align: center; padding: 10px;">?Œì† êµì°¨ë¡??†ìŒ</div>`;
    } else {
        listContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:0 2px;">
                <span style="font-size:11px; color:#aaa; font-weight:bold;">?“ ?Œì† êµì°¨ë¡?(?œê³µ???¤ì •)</span>
                <div style="display:flex; gap:4px;">
                    <button class="sigma-btn-secondary" style="padding:2px 5px; font-size:9px;" onclick="sortGroupMembers('SN')">S-N ?•ë ¬</button>
                    <button class="sigma-btn-secondary" style="padding:2px 5px; font-size:9px;" onclick="sortGroupMembers('EW')">E-W ?•ë ¬</button>
                </div>
            </div>
            <div style="display:flex; gap:6px; font-size:9px; color:#666; margin-bottom:4px; padding:0 8px;">
                <span style="width:15px; text-align:center;">??/span>
                <span style="width:35px; text-align:left;">ID</span>
                <span style="flex:1;">êµì°¨ë¡œëª…</span>
                <span style="width:32px; text-align:center;">?œë²ˆ</span>
                <span style="width:42px; text-align:center;">ê±°ë¦¬(m)</span>
            </div>
            ${members.map((j, idx) => {
            const diagOrder = j.extra.diagramOrder;
            const diagDist = j.extra.diagramDistDisp;
            const mismatchIcon = j._todMismatch ? `<span style="color:#e67e22; font-size:10px; margin-right:4px;" title="ê·¸ë£¹ ê¸°ì? ?¼ê³„?ê³¼ ë¶ˆì¼ì¹?>? ï¸</span>` : '';
            const isExcluded = j.extra.excludeFromTsd === true;
            
            return `
                <div class="group-member-item" draggable="true"
                     ondragstart="handleJunctionDragStart(event, '${j.id}')"
                     ondragover="handleJunctionDragOver(event)"
                     ondrop="handleJunctionDrop(event, '${j.id}')"
                     style="font-size:11.5px; padding:4px 8px; border-radius:4px; margin-bottom:3px; background:rgba(255,255,255,0.03); border:1px solid ${j._todMismatch ? 'rgba(230, 126, 34, 0.4)' : 'rgba(255,255,255,0.05)'}; cursor:grab; display:flex; justify-content:space-between; align-items:center; transition: all 0.2s; opacity: ${isExcluded ? 0.4 : 1};">
                    
                    <div style="display:flex; align-items:center; gap:6px; flex:1; overflow:hidden;">
                        <input type="checkbox" ${isExcluded ? '' : 'checked'} 
                               onchange="toggleJunctionTsdInclusion('${j.id}', this.checked)"
                               style="cursor:pointer; width:13px; height:13px; accent-color:var(--accent); flex-shrink:0;"
                               title="?œê³µ???¬í•¨ ?¬ë?">
                        <span style="color:rgba(255,255,255,0.4); font-size:9.5px; font-family:monospace; min-width:35px; text-align:left;">#${j.id}</span>
                        <span onclick="viewJunctionTODInGroup('${j.id}')" 
                              style="color:#eee; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding: 2px 0;">
                            ${mismatchIcon}${j.name || j.id}
                        </span>
                    </div>

                    <div style="display:flex; align-items:center; gap:4px;">
                        <input type="number" value="${diagOrder}" 
                               onchange="updateJunctionDiagramOrder('${j.id}', this.value)"
                               style="width:32px; height:18px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:var(--accent); text-align:center; font-size:10px; border-radius:2px; outline:none;"
                               title="?œì„œ">
                        <input type="number" value="${diagDist}" 
                               onchange="updateJunctionDiagramDist('${j.id}', this.value)"
                               style="width:42px; height:18px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; text-align:center; font-size:10px; border-radius:2px; outline:none;"
                               title="??êµì°¨ë¡œì???ê±°ë¦¬ (?ë™ê³„ì‚°?? ?˜ë™?˜ì • ê°€??">
                    </div>
                </div>`;
        }).join('')}
        `;
    }

    renderGroupList();
    
    // [? ê·œ] TSD ?¤ì • ?¸íŠ¸ UI ?Œë”ë§?
    renderGroupTsdSets(gid);

    // [ì¶”ê?] ?œê³µ??Time-Space Diagram) ?ë™ ?Œë”ë§?
    if (typeof renderTimeSpaceDiagram === 'function') {
        renderTimeSpaceDiagram();
    }

    setTimeout(() => {
        const listDiv = document.getElementById('group-list-container');
        const targetRow = listDiv.querySelector(`tr[data-gid="${gid}"]`);
        if (targetRow) targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    if (refreshChart) {
        renderGroupCycleChart();
    }
}

/** 
 * [?¬ìš©???”ì²­] ?¹ì • êµì°¨ë¡œì˜ TOD ?°ì´?°ë? ê·¸ë£¹ ?¸ì§‘ê¸??Œì´ë¸?ì°¨íŠ¸)??ë¡œë“œ 
 */
function viewJunctionTODInGroup(jid) {
    const j = STATE.junctions[jid];
    if (!j || !j.schedules) return;
    
    // 1. ?´ë‹¹ êµì°¨ë¡œê? ?í•œ ê·¸ë£¹ ID ê°€?¸ì˜¤ê¸?
    const gid = String(j.group);
    if (gid === "0" || !STATE.groups[gid]) {
        console.warn(`Junction ${jid} has no valid group assigned.`);
        return;
    }
    
    // 2. ?„ì¬ ?¸ì§‘ ê·¸ë£¹ ì»¨í…?¤íŠ¸ ?…ë°?´íŠ¸
    currentEditingGroup = gid;
    
    // 3. ê·¸ë£¹ ë²„í¼ ?¤ì?ì¤„ì„ ? íƒ??êµì°¨ë¡œì˜ ?¤ì?ì¤„ë¡œ êµì²´ (?¼ê´„ ?ìš© ?????°ì´?°ë? ?¬ìš©?˜ê²Œ ??
    STATE.groups[gid].schedules = JSON.parse(JSON.stringify(j.schedules));
    
    // 4. UI ì»¨íŠ¸ë¡??”ì†Œ ?™ê¸°??
    const inpEdit = document.getElementById('inp-edit-group-id');
    if (inpEdit) inpEdit.value = gid;
    
    const nameInp = document.getElementById('inp-group-name');
    if (nameInp) nameInp.value = (STATE.groups[gid].name || `ê·¸ë£¹ ${gid}`).trim();
    
    // 5. ?Œì´ë¸?ë°?ì°¨íŠ¸ ì¦‰ì‹œ ê°±ì‹ 
    renderGroupTODTable();
    renderGroupCycleChart();
    
    // 6. êµì°¨ë¡?? íƒ ì²˜ë¦¬ (ë§??´ë™/ì¤??ëµ?˜ì—¬ ê·¸ë£¹ ?”ë©´ ? ì?)
    if (typeof selectJunction === 'function') {
        selectJunction(jid);
    }
    
    // 7. ëª©ë¡ ??? íƒ ??ª© ?˜ì´?¼ì´??ì²˜ë¦¬
    document.querySelectorAll('.group-member-item').forEach(el => {
        el.style.borderColor = 'rgba(255,255,255,0.05)';
        el.style.background = 'rgba(255,255,255,0.03)';
    });
    const items = document.querySelectorAll('.group-member-item');
    for (let item of items) {
        if (item.innerText.includes(`#${jid}`)) {
            item.style.borderColor = 'var(--accent)';
            item.style.background = 'rgba(241, 196, 15, 0.1)';
            break;
        }
    }
    console.log(`[GroupView] Editor switched to Junction ${jid}'s TOD plan. Ready for batch apply.`);
}



/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
 *  ê·¸ë£¹ ?”ì¼ ? íƒ UI
 * ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */

window.toggleGroupTodPlanGroup = function(group) {
    if (typeof STATE !== 'undefined') {
        STATE._groupTodPlanGroup = group;
        renderGroupTODTable();
        updateGroupDayUI();
    }
};

function updateGroupDayUI() {
    const editContainer = document.getElementById('group-day-selector');
    const chartContainer = document.getElementById('group-chart-day-selector');
    if (!editContainer || !chartContainer) return;

    // 1. Edit Selector (Radio)
    const renderBtn = (lab, i) => {
        const isActive = (STATE.currentGroupDayTypeIdx === i);
        const group = STATE.groups[currentEditingGroup];
        const alias = (group && group.planAliases && group.planAliases[i]) ? group.planAliases[i] : "";
        const displayLabel = alias ? `${alias}` : lab;

        return `
            <label style="display:flex; align-items:center; gap:5px; font-size:11px; cursor:pointer; 
                          padding:3px 8px; border-radius:5px; border:1px solid ${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.1)'};
                          background: ${isActive ? 'rgba(241,196,15,0.15)' : 'rgba(255,255,255,0.03)'};
                          color: ${isActive ? 'white' : '#888'}; transition: all 0.2s; flex:1; justify-content:center;"
                          title="${lab}${alias ? ': ' + alias : ''}">
                <input type="radio" name="edit-group-day" style="width:13px; height:13px; margin:0;" 
                       ${isActive ? 'checked' : ''} onchange="setEditGroupDay(${i})">
                <span style="${isActive ? 'font-weight:bold; color:var(--accent);' : 'color:#ccc; font-size:10px;'}">${displayLabel}</span>
            </label>
        `;
    };

    let editHtml = '<div style="display:flex; flex-direction:column; gap:6px; width:100%;">';
    
    // 1?? ?¼ë°˜
    editHtml += '<div style="display:flex; align-items:center; gap:8px;">';
    editHtml += '<span style="font-size:10px; color:#aaa; min-width:35px; font-weight:bold;">[?¼ë°˜]</span>';
    
    // [ì¶”ê?] ?Œì´ë¸??¤ë” ?˜ì´?¼ì´???™ê¸°??
    for (let d = 0; d < 10; d++) {
        const head = document.getElementById(`day-header-${d}`);
        if (head) {
            if (STATE.currentGroupDayTypeIdx === d) head.classList.add('gtod-th-active');
            else head.classList.remove('gtod-th-active');
        }
    }
    editHtml += '<div style="display:flex; gap:4px; flex:1;">';
    for (let i = 0; i < 5; i++) editHtml += renderBtn(DAY_LABELS[i], i);
    editHtml += '</div></div>';

    // 2?? ?œì°¨
    editHtml += '<div style="display:flex; align-items:center; gap:8px;">';
    editHtml += '<span style="font-size:10px; color:var(--accent); min-width:35px; font-weight:bold;">[?œì°¨]</span>';
    editHtml += '<div style="display:flex; gap:4px; flex:1;">';
    for (let i = 5; i < 10; i++) editHtml += renderBtn(DAY_LABELS[i], i);
    editHtml += '</div></div>';


    editHtml += '</div>';
    editContainer.innerHTML = editHtml;

    // 2. Chart Comparison Selector (Checkbox)
    // 2. Chart Comparison Selector (Checkbox)
    let chartHtml = '<span style="color:#aaa; font-weight:bold; margin-right:4px;">?¼ê³„??</span>'; 

    DAY_LABELS.forEach((lab, i) => {
        const isSelected = selectedGroupDays.includes(i);
        chartHtml += `
            <label style="display:flex; align-items:center; gap:2px; font-size:11px; cursor:pointer; color: ${isSelected ? 'white' : '#666'};">
                <input type="checkbox" style="width:12px; height:12px; margin:0;" 
                       ${isSelected ? 'checked' : ''} onchange="toggleChartGroupDay(${i})">
                <span style="border-bottom: 2px solid ${isSelected ? DAY_COLORS[i] : 'transparent'}; padding-bottom:1px; min-width:14px; text-align:center;">${i + 1}</span>
            </label>
        `;
    });
    chartContainer.innerHTML = `<div style="display:flex; align-items:center; gap:6px;">${chartHtml}</div>`;
}

function toggleChartGroupDay(idx) {
    if (selectedGroupDays.includes(idx)) {
        if (selectedGroupDays.length > 1) selectedGroupDays = selectedGroupDays.filter(d => d !== idx);
    } else {
        selectedGroupDays.push(idx);
    }
    updateGroupDayUI();
    renderGroupCycleChart();
}

/** ?¸ì§‘ ?”ì¼ ? íƒ (?¼ë””?? */
function setEditGroupDay(idx) {
    STATE.currentGroupDayTypeIdx = idx;
    // ?´ì œ ì²´í¬ë°•ìŠ¤(ê·¸ë˜??ë¹„êµ)?€ ?°ë™?˜ì? ?ŠìŒ
    updateGroupDayUI();
    renderGroupTODTable();
    renderGroupCycleChart();

    // ? íƒ???”ì¼ ì»¬ëŸ¼?¼ë¡œ ?ë™ ?¤í¬ë¡?
    setTimeout(() => {
        const header = document.getElementById(`day-header-${idx}`);
        const container = document.getElementById('group-tod-table-container');
        if (header && container) {
            const headerLeft = header.offsetLeft;
            // ?ì˜ '#' ì»¬ëŸ¼ widthê°€ ?€??30px?´ë?ë¡?ì¡°ê¸ˆ ?¬ìœ ë¥??ê³  ?¤í¬ë¡?
            container.scrollTo({ left: headerLeft - 40, behavior: 'smooth' });
        }
    }, 50);
}

function changeGroupDayType(idx) { setEditGroupDay(idx); }

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
 *  ê·¸ë£¹ TOD ë³µì‚¬
 * ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
function copyGroupTODDay() {
    if (!currentEditingGroup || !STATE.groups[currentEditingGroup]) return;
    const fromIdx = parseInt(document.getElementById('copy-from-day').value);
    const toIdx = STATE.currentGroupDayTypeIdx;

    if (fromIdx === toIdx) { alert("ì¶œë°œì§€?€ ëª©ì ì§€ê°€ ê°™ìŠµ?ˆë‹¤."); return; }
    if (!confirm(`${DAY_LABELS[fromIdx]} TOD ?°ì´?°ë? ${DAY_LABELS[toIdx]}ë¡?ë³µì‚¬?˜ì‹œê² ìŠµ?ˆê¹Œ?`)) return;

    const fromData = STATE.groups[currentEditingGroup].schedules[fromIdx];
    STATE.groups[currentEditingGroup].schedules[toIdx] = JSON.parse(JSON.stringify(fromData));

    renderGroupTODTable();
    renderGroupCycleChart();
    alert("ë³µì‚¬ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??");
}

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
 *  ê·¸ë£¹ TOD ?Œì´ë¸??Œë”ë§?
 * ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
function renderGroupTODTable() {
    const gid = currentEditingGroup;
    if (!gid || !STATE.groups[gid]) return;

    const group = STATE.groups[gid];

    let html = '';
    // ì£¼ê¸°ë¥???ë²ˆì— ë³´ê¸° ?„í•´ 16ì¤?ëª¨ë‘ ì¶œë ¥ (ì¢Œìš° 2???€??1?¨ìœ¼ë¡??˜ê³  ?”ì¼ 5ê°œë? ê°€ë¡œë¡œ ë°°ì¹˜?˜ë„ë¡?ë³€ê²?ê°€?¥í•˜ì§€ë§? 
    // ?¬ìš©?ê? '??ë²ˆì— ë³´ê²Œ' ?´ë‹¬?¼ê³  ?ˆìœ¼ë¯€ë¡?16ì¤??„ì²´ë¥??”ì¼ë³?ì»¬ëŸ¼?¼ë¡œ êµ¬ì„±)
    for (let i = 0; i < 16; i++) {
        const isSelected = (STATE.selectedTodPlanIdx === i);
        const rowBg = isSelected ? 'background:rgba(0,100,220,0.15);' : '';
        html += `<tr style="border-bottom: 1px solid #222; height: 18px; cursor:pointer; ${rowBg}" 
                     class="tod-row" data-plan-idx="${i}" 
                     onclick="selectTodPlan(${i})" 
                     title="?´ë¦­: ${i+1}ë²??œê°„ê³„íš?¼ë¡œ ?œê³µ??ë¶„ì„">`;
        html += `<td style="text-align:center; color:${isSelected ? '#33aaff' : '#555'}; border-right:1px solid #333; padding:0; font-size:10px; font-weight:${isSelected ? '800' : 'normal'};">${i + 1}</td>`;

        for (let d = 0; d < 10; d++) {
            const sched = (group.schedules && group.schedules[d]) ? group.schedules[d] : [];
            const s = (sched && sched[i]) ? sched[i] : { h: -1, m: 0, cycle: 100 };
            if (s.cycle === undefined) s.cycle = 100;

            const isCurrentDay = (STATE.currentGroupDayTypeIdx === d);
            const activeClass = isCurrentDay ? 'gtod-td-active' : '';
            
            // ?œê°„??-1??ê²½ìš°(ë¯¸ì‚¬?? ?¤ë‹¤???¨ê³¼ ?ìš©
            const isUnused = (s.h === -1);
            const unusedStyle = isUnused ? 'opacity: 0.35; filter: grayscale(1);' : '';

            html += `<td style="text-align:center; border-right:1px solid #333; padding:0; ${unusedStyle}" class="${activeClass}">
                <div style="display:flex; justify-content:center; align-items:center; height: 100%;">
                    <input type="number" class="sigma-input input-mini" value="${s.h}" min="-1" max="23" 
                           style="width:24px; height:16px; line-height:1; padding:0; text-align:center; font-size:9.5px; background:transparent; border:none;" 
                           data-type="group-sched" data-field="h" data-idx="${i}" data-day="${d}">
                    <span style="color:#444; margin:0; scale: 0.8; height:16px; line-height:16px;">:</span>
                    <input type="number" class="sigma-input input-mini" value="${s.m}" min="0" max="59" 
                           style="width:24px; height:16px; line-height:1; padding:0; text-align:center; font-size:9.5px; background:transparent; border:none;" 
                           data-type="group-sched" data-field="m" data-idx="${i}" data-day="${d}">
                </div>
            </td>`;
            html += `<td style="text-align:center; border-right:1px solid #333; padding:0; ${unusedStyle}" class="${activeClass}">
                <input type="number" class="sigma-input input-mini" value="${s.cycle}" min="0" max="999" 
                       style="width:34px; height:16px; line-height:1; padding:0; text-align:center; color:var(--accent); font-size:10px; background:transparent; border-color:transparent;" 
                       data-type="group-sched" data-field="cycle" data-idx="${i}" data-day="${d}">
            </td>`;
            html += `<td style="text-align:center; border-right:${d === 9 ? 'none' : '1px solid #555'}; padding:0; ${unusedStyle}" class="${activeClass}">
                <input type="number" class="sigma-input input-mini" value="${s.idx || 1}" min="1" max="16" 
                       style="width:26px; height:16px; line-height:1; padding:0; text-align:center; color:#888; font-size:10px; background:transparent; border-color:transparent;" 
                       data-type="group-sched" data-field="idx" data-idx="${i}" data-day="${d}">
            </td>`;
        }
        html += `</tr>`;
    }
    document.getElementById('group-tod-body').innerHTML = html;
    if(typeof updateGroupDayUI === 'function') updateGroupDayUI();
    updateGroupDayUI();
}

/**
 * TOD ??? íƒ ???œê³µ???°ë™
 */
function selectTodPlan(idx) {
    STATE.selectedTodPlanIdx = idx;
    renderGroupTODTable();  // ?˜ì´?¼ì´??ê°±ì‹ 
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
 *  ê·¸ë£¹ ì£¼ê¸° ì°¨íŠ¸
 * ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
function renderGroupCycleChart() {
    const gid = currentEditingGroup;
    if (!gid || !STATE.groups[gid]) return;
    const group = STATE.groups[gid];

    const labels = [];
    for (let i = 0; i < 144; i++) {
        const totalMinutes = i * 10;
        const hh = Math.floor(totalMinutes / 60);
        const mm = totalMinutes % 60;
        labels.push(mm === 0 ? `${hh}h` : "");
    }

    const datasets = selectedGroupDays.map(dIdx => {
        const sched = group.schedules[dIdx];
        const chartData = [];
        for (let i = 0; i < 144; i++) {
            const totalMinutes = i * 10;
            let activeCycle = 100, maxTotal = -1;
            sched.forEach(s => {
                if (s.h !== -1) {
                    const sTotal = s.h * 60 + s.m;
                    if (totalMinutes >= sTotal && sTotal > maxTotal) { maxTotal = sTotal; activeCycle = s.cycle || 0; }
                }
            });
            chartData.push(activeCycle);
        }
        const isActive = (STATE.currentGroupDayTypeIdx === dIdx);
        return {
            label: DAY_LABELS[dIdx], data: chartData, borderColor: DAY_COLORS[dIdx],
            backgroundColor: isActive ? 'rgba(241,196,15,0.05)' : 'transparent',
            borderWidth: isActive ? 3 : 1.5, stepped: true, fill: isActive,
            pointRadius: 0, pointHitRadius: 10, tension: 0
        };
    });

    const ctx = document.getElementById('group-cycle-chart').getContext('2d');
    if (groupCycleChart) groupCycleChart.destroy();

    groupCycleChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { min: 0, grid: { color: '#222' }, ticks: { color: '#666', font: { size: 10 }, stepSize: 50 } },
                x: {
                    grid: { color: (ctx) => (ctx.index % 6 === 0 ? '#333' : '#111'), lineWidth: (ctx) => (ctx.index % 6 === 0 ? 1 : 0) },
                    ticks: { color: '#666', font: { size: 10 }, autoSkip: false, maxRotation: 0 }
                }
            },
            plugins: {
                legend: { display: selectedGroupDays.length > 1, labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12 } },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const idx = items[0].dataIndex;
                            const h = Math.floor((idx * 10) / 60), m = (idx * 10) % 60;
                            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        }
                    }
                }
            }
        }
    });
}

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
 *  ê·¸ë£¹ ëª©ë¡ ?Œë”ë§?
 * ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
function renderGroupList() {
    const listDiv = document.getElementById('group-list-container');
    if (!listDiv) return;

    // [Fix] junctions ?°ì´?°ì—??ê·¸ë£¹ IDë¥?ì¶”ì¶œ?˜ì—¬ STATE.groups???™ê¸°??(CSV ë¯¸ë¡œ???œì—???œì‹œ ë³´ì¥)
    Object.values(STATE.junctions).forEach(j => {
        if (j.group && j.group !== "0" && j.group !== 0) {
            const gid = String(j.group);
            if (!STATE.groups[gid]) {
                const emptyScheds = Array.from({ length: 10 }, () => 
                    Array.from({ length: 16 }, () => ({ h: -1, m: 0, cycle: 100 }))
                );
                STATE.groups[gid] = { id: gid, name: `ê·¸ë£¹ ${gid}`, schedules: emptyScheds };
            }
        }
    });

    const gids = Object.keys(STATE.groups).sort((a, b) => Number(a) - Number(b));
    if (gids.length === 0) {
        listDiv.innerHTML = '<div style="color:#666; font-size:13px; padding:30px; text-align:center;">?€?¥ëœ ê·¸ë£¹ ?°ì´?°ê? ?†ìŠµ?ˆë‹¤.</div>';
        return;
    }

    // ìµœì ?? ëª¨ë“  êµì°¨ë¡œë? ?œíšŒ?˜ì—¬ ê·¸ë£¹ë³??Œì† ?•ë³´ ë°??¼ê³„???¼ì¹˜???Œì•…
    const groupMeta = {};
    Object.values(STATE.junctions).forEach(j => {
        const g = String(j.group);
        if (!groupMeta[g]) groupMeta[g] = { count: 0, firstSched: null, hasMismatch: false };
        
        groupMeta[g].count++;
        
        // ?¬ìš©?˜ì? ?ŠëŠ” ?¬ë¡¯(h === -1)??background ?°ì´??cycle, idx ?? ë¬´ì‹œ?˜ë„ë¡??•ê·œ??
        const normalizedSched = j.schedules ? j.schedules.map(day => 
            day.map(slot => slot.h === -1 ? { h: -1, m: 0 } : slot)
        ) : null;
        const currentSched = JSON.stringify(normalizedSched);
        
        if (groupMeta[g].firstSched === null) {
            groupMeta[g].firstSched = currentSched;
        } else if (!groupMeta[g].hasMismatch && groupMeta[g].firstSched !== currentSched) {
            groupMeta[g].hasMismatch = true;
        }
    });

    let html = `
    <table class="group-list-table" style="width:100%; border-collapse:collapse; font-size:11.5px; table-layout: fixed;">
        <thead style="position: sticky; top: 0; background: #1a1a1a; z-index: 5;">
            <tr style="background:#2a2a2a; border-bottom:1px solid #444;">
                <th style="padding:6px 10px; text-align:center; width:45px; color:#aaa; font-size:11px;">ID</th>
                <th style="padding:6px 10px; text-align:left; color:#aaa; font-size:11px;">ê·¸ë£¹ëª?(Description)</th>
                <th style="padding:6px 10px; text-align:center; width:65px; color:#aaa; font-size:11px;">êµì°¨ë¡?/th>
            </tr>
        </thead>
        <tbody>
    `;

    gids.forEach(gid => {
        const group = STATE.groups[gid];
        const meta = groupMeta[String(gid)] || { count: 0, hasMismatch: false };
        const isEditing = (gid === currentEditingGroup);
        const bg = isEditing ? 'rgba(0, 212, 255, 0.15)' : 'transparent';
        const color = isEditing ? 'var(--accent)' : '#eee';
        const weight = isEditing ? '700' : '400';
        const gName = (group.name || `ê·¸ë£¹ ${gid}`).trim();
        
        // ?¼ê³„??ë¶ˆì¼ì¹??„ì´ì½??¤ì •
        const mismatchIcon = meta.hasMismatch ? `<span style="color:#e67e22; margin-left:5px; font-size:10px;" title="êµì°¨ë¡?ê°??¼ê³„???°ì´??ë¶ˆì¼ì¹?>? ï¸</span>` : '';

        html += `
            <tr data-gid="${gid}" onclick="setEditingGroup(${gid})"
                style="cursor:pointer; background:${bg}; color:${color}; font-weight:${weight}; border-bottom:1px solid #2a2a2a; border-left: 3px solid ${meta.hasMismatch ? '#e67e22' : 'transparent'}; transition: all 0.2s;">
                <td style="padding:5px 10px; text-align:center; color:var(--accent);">${gid}</td>
                <td style="padding:5px 10px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${gName}${mismatchIcon}</td>
                <td style="padding:5px 10px; text-align:center; opacity:0.8;">${meta.count}</td>
            </tr>
            `;
    });

    html += `</tbody></table>`;
    listDiv.innerHTML = html;
}

function setEditingGroup(gid) {
    document.getElementById('inp-edit-group-id').value = gid;
    loadGroupInfo();
}

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
 *  ê·¸ë£¹ ?¤ì?ì¤??´ë¦„ ?…ë°?´íŠ¸
 * ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
function updateGroupSched(idx, f, v, dayIdx = null) {
    if (!currentEditingGroup || !STATE.groups[currentEditingGroup]) return;
    const targetDayIdx = (dayIdx !== null) ? dayIdx : STATE.currentGroupDayTypeIdx;
    STATE.groups[currentEditingGroup].schedules[targetDayIdx][idx][f] = parseInt(v) || 0;

    // ì°¨íŠ¸ ?…ë°?´íŠ¸ (?´ì „ ìµœì ??? ì? - TOD ?°ì´??ë³€ê²??œì—ë§?redraw)
    renderGroupCycleChart();
    if (document.getElementById('tab-stats').classList.contains('active')) renderStats();
}

function updateGroupName(val) {
    if (!currentEditingGroup || !STATE.groups[currentEditingGroup]) return;
    STATE.groups[currentEditingGroup].name = val;
    renderGroupList();
    updateGroupDayUI();
}

function applyGroupToMembers() {
    try {
        if (!currentEditingGroup || !STATE.groups[currentEditingGroup]) {
            alert("?¸ì§‘??ê·¸ë£¹??? íƒ?˜ì? ?Šì•˜?µë‹ˆ??");
            return;
        }
        if (!confirm(`ê·¸ë£¹ ${currentEditingGroup}??ëª¨ë“  10???¤ì •???Œì†??ëª¨ë“  êµì°¨ë¡œì— ?¼ê´„ ?ìš©?˜ì‹œê² ìŠµ?ˆê¹Œ?`)) return;

        const groupSchedules = STATE.groups[currentEditingGroup].schedules;
        let count = 0;
        Object.values(STATE.junctions).forEach(j => {
            if (String(j.group) === String(currentEditingGroup)) {
                j.schedules = JSON.parse(JSON.stringify(groupSchedules));
                j.weeklyPlan = STATE.groups[currentEditingGroup].weeklyPlan || "1;1;1;1;1;2;3";
                
                // [Fix] ê·¸ë£¹ TOD?ì„œ ?˜ì •??cycle??j.dayPlans ?ë„ ?™ê¸°?”ë˜?´ì•¼ DB ë°˜ì˜ ???›ë‚  cycleë¡???–´?°ì—¬ ë¶ˆì¼ì¹˜ê? ë°œìƒ?˜ëŠ” ê²ƒì„ ë°©ì?
                if (j.dayPlans) {
                    for (let d = 0; d < 10; d++) {
                        if (groupSchedules[d] && j.dayPlans[d]) {
                            for (let s = 0; s < 16; s++) {
                                const schedItem = groupSchedules[d][s];
                                if (schedItem && schedItem.cycle && schedItem.idx > 0) {
                                    const targetIdx = schedItem.idx - 1;
                                    if (j.dayPlans[d][targetIdx]) {
                                        j.dayPlans[d][targetIdx].cycle = schedItem.cycle;
                                    }
                                }
                            }
                        }
                    }
                }
                
                count++;
            }
        });
        
        loadGroupInfo(true);
        if (STATE.activeJid && String(STATE.junctions[STATE.activeJid].group) === String(currentEditingGroup)) {
            renderRingTables();
        }
        alert(`${count}ê°?êµì°¨ë¡œì— ê·¸ë£¹ TOD ?¤ì • ?ìš© ?„ë£Œ?˜ì—ˆ?µë‹ˆ??`);
    } catch (e) {
        console.error("Apply Error:", e);
        alert("?ìš© ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: " + e.message);
    }
}

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
 *  ê·¸ë£¹ CSV ?€??ë¶ˆëŸ¬?¤ê¸°
 * ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
 *  ê·¸ë£¹ CSV ?€??ë¶ˆëŸ¬?¤ê¸° (?µí•© ?¸ë“¤??
 * ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */




/** ê·¸ë£¹ TOD CSV ?°ì´??ì²˜ë¦¬ ?µì‹¬ ë¡œì§ (db_tod_plans.csv ê·œê²© ?¸í™˜ ì¶”ê?) */


/** [? ê·œ] db_tod_plans.csv ?Œì¼???½ì–´ ?„ì¬ ê·¸ë£¹???¤ì?ì¤„ë¡œ ë§¤í•‘ */


/** ê¸°ì¡´ ?ˆê±°??ê·¸ë£¹ CSV ì²˜ë¦¬ ë¡œì§ ë¶„ë¦¬ */
function handleLegacyGroupCSV(lines, isAutoLoad) {
    const newGroups = {};
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 3) continue;
        const gid = parseInt(cols[0]);
        if (isNaN(gid)) continue;
        
        const region = cols[1];
        let gName = cols[2] || `ê·¸ë£¹ ${gid}`;
        const schedules = Array.from({ length: 10 }, () => createEmptySched());

        const parseSched = (str, targetSched) => {
            const items = (str || "").split(';');
            items.forEach((item, idx) => {
                if (idx >= 16 || !item) return;
                const parts = item.split('|');
                if (parts[0].includes(':')) {
                    const bits = parts[0].split(':').map(Number);
                    targetSched[idx] = { h: bits[0], m: bits[1], cycle: parseInt(parts[1]) || 100, idx: parseInt(parts[2]) || 1 };
                } else if (parts[0] === "-1") {
                    targetSched[idx] = { h: -1, m: 0, cycle: parseInt(parts[1]) || 100, idx: parseInt(parts[2]) || 1 };
                }
            });
        };

        if (cols.length >= 8) { 
            const numDays = Math.min(cols.length - 3, 10);
            for (let d = 0; d < numDays; d++) parseSched(cols[d + 3], schedules[d]); 
        }
        else if (cols.length >= 4) parseSched(cols[3], schedules[0]);

        // [? ê·œ] TSD ?¤ì • ?¸íŠ¸ ?Œì‹± (Index 13, 14, 15)
        const tsdConfigs = [];
        for (let i = 0; i < 3; i++) {
            const colIdx = 13 + i;
            if (cols[colIdx]) {
                const parts = cols[colIdx].split('|');
                tsdConfigs.push({
                    enabled: parseInt(parts[0]) || 0,
                    order: (parts[1] && parts[1] !== "") ? parts[1].split(';') : [],
                    distances: (parts[2] && parts[2] !== "") ? parts[2].split(';').map(val => parseFloat(val) || 0) : []
                });
            } else {
                tsdConfigs.push({ enabled: 0, order: [], distances: [] });
            }
        }

        const planAliases = (cols[16]) ? cols[16].split(';') : Array(10).fill("");
        newGroups[gid] = { id: gid, region: region, name: gName, schedules: schedules, tsdConfigs: tsdConfigs, planAliases: planAliases };
        count++;
    }

    if (isAutoLoad || confirm(`ì´?${count}ê°œì˜ ê·¸ë£¹ ?•ë³´ë¥?ë¶ˆëŸ¬?”ìŠµ?ˆë‹¤. ?ìš©?˜ì‹œê² ìŠµ?ˆê¹Œ?`)) {
        Object.assign(STATE.groups, newGroups);
        if (currentEditingGroup) loadGroupInfo();
        renderGroupList();
    }
}

function updateJunctionDiagramOrder(jid, val) {
    const j = STATE.junctions[jid];
    if (!j) return;
    if (!j.extra) j.extra = {};
    j.extra.diagramOrder = parseInt(val);
    loadGroupInfo(true, j.group); // UI ?„ì²´ ê°±ì‹  (?œì„œ ë³€ê²½ì— ?°ë¥¸ ê±°ë¦¬ ?¬ê³„???„ìš”)
}

function updateJunctionDiagramDist(jid, val) {
    const j = STATE.junctions[jid];
    if (!j) return;
    if (!j.extra) j.extra = {};
    const dist = parseInt(val);
    // ?˜ë™ ?…ë ¥ê°??€??
    j.extra.diagramDist = dist;
    loadGroupInfo(true, j.group);
}

// --- [? ê·œ] êµì°¨ë¡??œì„œ ì¡°ì •???„í•œ ?œë˜ê·????œë¡­ ?¸ë“¤??---
function handleJunctionDragStart(e, jid) {
    e.dataTransfer.setData('text/plain', jid);
    e.currentTarget.style.opacity = '0.4';
    e.currentTarget.style.border = '1px dashed var(--accent)';
}

function handleJunctionDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleJunctionDrop(e, targetJid) {
    e.preventDefault();
    const draggedJid = e.dataTransfer.getData('text/plain');
    if (draggedJid === targetJid) {
        loadGroupInfo(true);
        return;
    }

    const draggedJ = STATE.junctions[draggedJid];
    const targetJ = STATE.junctions[targetJid];
    if (!draggedJ || !targetJ) return;

    const gid = String(draggedJ.group);
    let members = Object.values(STATE.junctions).filter(j => String(j.group) === gid);
    members.sort((a, b) => {
        const aExcluded = a.extra && a.extra.excludeFromTsd === true;
        const bExcluded = b.extra && b.extra.excludeFromTsd === true;
        if (aExcluded !== bExcluded) return aExcluded ? 1 : -1;
        return (a.extra.diagramOrder || 0) - (b.extra.diagramOrder || 0);
    });

    const draggedIdx = members.findIndex(m => m.id === draggedJid);
    const targetIdx = members.findIndex(m => m.id === targetJid);

    if (draggedIdx !== -1 && targetIdx !== -1) {
        // ë°°ì—´?ì„œ ??¸°ê¸?
        const [movedItem] = members.splice(draggedIdx, 1);
        members.splice(targetIdx, 0, movedItem);

        // ?œì„œ(diagramOrder) ?œì°¨?ìœ¼ë¡??¬ë???
        members.forEach((m, i) => {
            if (!m.extra) m.extra = {};
            m.extra.diagramOrder = i + 1;
        });

        loadGroupInfo(true, gid);
    }
}

/**
 * ê·¸ë£¹ ëª©ë¡ ?œë˜ê·??¤í¬ë¡?ì´ˆê¸°??
 */
(function initGroupListDragScroll() {
    document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('group-list-container');
        if (!el) return;

        let isDragging = false, startY = 0, startScroll = 0;

        el.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startScroll = el.scrollTop;
            el.style.cursor = 'grabbing';
            el.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const delta = e.clientY - startY;
            el.scrollTop = startScroll - delta;
        });

        window.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            el.style.cursor = 'grab';
            el.style.userSelect = '';
        });

        el.style.cursor = 'grab';
    });
})();
/** [? ê·œ] ê·¸ë£¹ë³?TSD ?¤ì • ?¸íŠ¸ UI ?Œë”ë§?*/
function renderGroupTsdSets(gid) {
    const group = STATE.groups[gid];
    if (!group) return;

    for (let i = 0; i < 3; i++) {
        const config = (group.tsdConfigs && group.tsdConfigs[i]) ? group.tsdConfigs[i] : { enabled: 0, order: [], distances: [] };
        const checkEl = document.getElementById(`tsd-set-enable-${i}`);
        const infoEl = document.getElementById(`tsd-set-info-${i}`);
        
        if (checkEl) checkEl.checked = (config.enabled === 1);
        if (infoEl) {
            if (config.order && config.order.length > 0) {
                const totalDist = config.distances.reduce((a, b) => a + b, 0);
                infoEl.innerHTML = `
                    <div style="color:var(--neon-cyan);">êµì°¨ë¡? ${config.order.length}ê°?/div>
                    <div style="color:#aaa;">ì´?ê±°ë¦¬: ${Math.round(totalDist).toLocaleString()}m</div>
                `;
            } else {
                infoEl.innerHTML = '<span style="color:#444;">?°ì´???†ìŒ</span>';
            }
        }
    }
}

/** [? ê·œ] ?„ì¬ êµ¬ì„±???¹ì • TSD ?¸íŠ¸??ìº¡ì²˜?˜ì—¬ ?€??*/
function captureCurrentTsdToSet(setIdx) {
    if (!currentEditingGroup) { alert("ê·¸ë£¹??ë¨¼ì? ? íƒ?˜ì„¸??"); return; }
    const gid = currentEditingGroup;
    const group = STATE.groups[gid];

    // ?„ì¬ ?”ë©´(ë©¤ë²„ ë¦¬ìŠ¤????êµ¬ì„±???˜ì§‘
    let members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    const valid = members.filter(j => j.extra && !j.extra.excludeFromTsd);
    valid.sort((a, b) => (a.extra.diagramOrder || 0) - (b.extra.diagramOrder || 0));

    if (valid.length < 2) {
        alert("?œê³µ?„ì— ?¬í•¨??êµì°¨ë¡œê? 2ê°??´ìƒ?´ì–´???€?¥í•  ???ˆìŠµ?ˆë‹¤.");
        return;
    }

    if (!group.tsdConfigs) group.tsdConfigs = Array.from({ length: 3 }, () => ({ enabled: 0, order: [], distances: [] }));

    const order = valid.map(m => m.id);
    const distances = [];
    for (let i = 1; i < valid.length; i++) {
        // diagramDistDisp: ?˜ë™ ?…ë ¥???ˆìœ¼ë©??˜ë™ê°? ?†ìœ¼ë©??ë™ê³„ì‚°ê°?
        distances.push(valid[i].extra.diagramDistDisp || 0);
    }

    group.tsdConfigs[setIdx] = {
        enabled: 1, // ?€?????ë™ ?œì„±??
        order: order,
        distances: distances
    };

    renderGroupTsdSets(gid);
    alert(`?„ì¬ êµ¬ì„±??SET ${setIdx + 1}???€?¥ë˜?ˆìŠµ?ˆë‹¤.`);
}

/** [? ê·œ] TSD ?¤ì • ?¸íŠ¸ ?œì„±???¬ë? ?…ë°?´íŠ¸ */
function updateGroupTsdConfig(setIdx) {
    if (!currentEditingGroup) return;
    const gid = currentEditingGroup;
    const group = STATE.groups[gid];
    if (!group.tsdConfigs) return;

    const checkEl = document.getElementById(`tsd-set-enable-${setIdx}`);
    if (checkEl && group.tsdConfigs[setIdx]) {
        group.tsdConfigs[setIdx].enabled = checkEl.checked ? 1 : 0;
    }
}



function autoGeneratePlanAliases(groupObj) {
    if (!groupObj || !groupObj.weeklyPlan) return;
    const parts = groupObj.weeklyPlan.split(';');
    const days = ["??, "??, "??, "ëª?, "ê¸?, "??, "??];
    const aliases = Array(10).fill("");
    
    const planToDays = {};
    parts.forEach((p, idx) => {
        const planIdx = parseInt(p) - 1;
        if (planIdx >= 0 && planIdx < 10) {
            if (!planToDays[planIdx]) planToDays[planIdx] = [];
            planToDays[planIdx].push(days[idx]);
        }
    });

    for (let i = 0; i < 10; i++) {
        if (planToDays[i]) {
            aliases[i] = planToDays[i].join(', ');
        }
    }
    
    groupObj.planAliases = aliases;
    
    document.querySelectorAll('.inp-plan-alias').forEach(inp => {
        const d = parseInt(inp.getAttribute('data-day'));
        inp.value = groupObj.planAliases[d] || "";
    });
    
    // UI ?…ë°?´íŠ¸
    const chartContainer = document.getElementById('group-chart-day-selector');
    if (chartContainer) {
        let chartHtml = '<select class="phase-select" style="width:90px;" onchange="setChartGroupDay(parseInt(this.value))">';
        for (let i = 0; i < 10; i++) {
            const alias = groupObj.planAliases[i] || "";
            const lab = "?¼ê³„??" + (i + 1);
            chartHtml += '<option value="' + i + '" ' + (STATE.currentGroupDayTypeIdx === i ? 'selected' : '') + '>' + (alias ? alias : lab) + '</option>';
        }
        chartHtml += '</select>';
        chartContainer.innerHTML = chartHtml;
    }
}
// Initialize group UI properly
if (typeof STATE._groupTodPlanGroup === 'undefined') {
    STATE._groupTodPlanGroup = 1;
}


// ----------------------------------------------------
// Group Weekly Plan rendering
// ----------------------------------------------------
function renderGroupWeeklyPlanTable() {
    const container = document.getElementById('group-weekly-plan-container');
    if (!container) return;

    const gid = currentEditingGroup;
    const group = gid ? STATE.groups[gid] : null;
    const weeklyPlan = (group && group.weeklyPlan) ? group.weeklyPlan.split(';') : ["1", "1", "1", "1", "1", "2", "3"];
    const weekLabels = ["??, "??, "??, "ëª?, "ê¸?, "??, "??];
    
    let html = `
        <div style="color: #38bdf8; font-weight: bold; font-size: 13px; margin-bottom: 8px;">ì£¼ê°„ ?¼ê³„?í‘œ</div>
        <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px; border: 1px solid rgba(255,255,255,0.08);">
            <thead>
                <tr style="background: rgba(255,255,255,0.05);">
                    ${weekLabels.map((w, idx) => {
                        return `<th style="padding: 6px; color: #94a3b8; border: 1px solid rgba(255,255,255,0.08);">${w}</th>`;
                    }).join('')}
                </tr>
            </thead>
            <tbody>
                <tr>
                    ${weekLabels.map((w, idx) => {
                        const planNum = parseInt(weeklyPlan[idx] || 1);
                        return `
                            <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.08); background: transparent;">
                                <input type="number" class="sigma-input inp-weekly-plan" data-index="${idx}" min="1" max="10" 
                                       value="${planNum}" onchange="updateGroupWeeklyPlanData(${idx}, this.value)"
                                       style="width:100%; height:20px; font-size:12px; font-weight:500; text-align:center; color:#cbd5e1; background:transparent; border:none; padding:0;">
                            </td>
                        `;
                    }).join('')}
                </tr>
            </tbody>
        </table>
    `;
    container.innerHTML = html;
}

function updateGroupWeeklyPlanData(idx, val) {
    const gid = currentEditingGroup;
    if (!gid || !STATE.groups[gid]) return;
    
    let parts = (STATE.groups[gid].weeklyPlan || "1;1;1;1;1;2;3").split(';');
    val = parseInt(val);
    if(isNaN(val) || val < 1 || val > 10) val = 1;
    parts[idx] = val;
    STATE.groups[gid].weeklyPlan = parts.join(';');
    
    if (typeof autoGeneratePlanAliases === 'function') {
        autoGeneratePlanAliases(STATE.groups[gid]);
    }
}


window.toggleGroupTodPlanGroup = function(idx) {
    STATE._groupTodPlanGroup = idx;
    if(typeof window.updateGroupDayUI === 'function') window.updateGroupDayUI();
};

window.updateGroupDayUI = function() {
    const grp = STATE._groupTodPlanGroup || 1;
    const startIdx = (grp - 1) * 5;
    const endIdx = startIdx + 4;
    
    for (let i = 0; i < 10; i++) {
        const th = document.getElementById('day-header-' + i);
        if (th) {
            th.style.display = (i >= startIdx && i <= endIdx) ? '' : 'none';
        }
    }
    
    const subHeaderRow = document.querySelector('.gtod-tr-sub');
    if (subHeaderRow) {
        const subHeaders = subHeaderRow.querySelectorAll('th');
        for (let i = 0; i < subHeaders.length; i++) {
            const dayIdx = Math.floor(i / 3);
            subHeaders[i].style.display = (dayIdx >= startIdx && dayIdx <= endIdx) ? '' : 'none';
        }
    }
    
    const tbody = document.getElementById('group-tod-body');
    if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length === 31) {
                for (let i = 1; i <= 30; i++) {
                    const dayIdx = Math.floor((i - 1) / 3);
                    tds[i].style.display = (dayIdx >= startIdx && dayIdx <= endIdx) ? '' : 'none';
                }
            }
        });
    }

    const btn1 = document.getElementById('btn-gtod-group-1');
    const btn2 = document.getElementById('btn-gtod-group-2');
    if (btn1) btn1.style.backgroundColor = (grp === 1) ? '#0ea5e9' : '#334155';
    if (btn2) btn2.style.backgroundColor = (grp === 2) ? '#0ea5e9' : '#334155';
};

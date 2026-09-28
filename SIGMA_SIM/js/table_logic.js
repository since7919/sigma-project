/**
 * table_logic.js
 * ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
 * ?Œì´ë¸??…ë ¥ ?±ëŠ¥ ìµœì ??(Debounce, Direct DOM Update)
 * ë°?ë°©í–¥???€ ?´ë™ (Navigation) ë¡œì§
 */

const tableEventInitialized = {
    tod: false,
    mov: false,
    summary: false,
    groupTod: false
};

function initTableEventHandlers() {
    console.log("[TableLogic] Initializing Event Handlers...");

    // 0 ê°??ë¦¬ê²?ì²˜ë¦¬ (?Œë§ˆ???´ëž˜??? ê?)
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('sigma-input')) {
            let isZeroOrEmpty = false;
            if (e.target.type === 'number') {
                isZeroOrEmpty = (parseFloat(e.target.value) || 0) === 0;
            } else if (e.target.type === 'text') {
                isZeroOrEmpty = e.target.value.trim() === '' || e.target.value === '0';
            } else {
                return;
            }
            e.target.classList.toggle('val-zero', isZeroOrEmpty);
            e.target.classList.toggle('val-non-zero', !isZeroOrEmpty);
        }
    });

    // 1. Phase/Split ?Œì´ë¸?(Split, AllRed, Yellow ??
    const todContainer = document.getElementById('tod-container');
    if (todContainer && !tableEventInitialized.tod) {
        todContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableInput(e.target);
        });
        todContainer.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
        });
        tableEventInitialized.tod = true;
    }

    // 2. ?´ë™ë¥?êµ¬ì„± ?Œì´ë¸?(movA, movB, pedMov ??
    const movContainer = document.getElementById('mov-combined-container');
    if (movContainer && !tableEventInitialized.mov) {
        movContainer.addEventListener('change', (e) => {
            if (e.target.dataset.type === 'mov') handleMovInput(e.target);
        });
        movContainer.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
        });
        tableEventInitialized.mov = true;
    }

    // 3. ?”ì•½ ?Œì´ë¸?(TOD Schedule & Pattern)
    const summaryContainer = document.getElementById('tod-summary-container');
    if (summaryContainer && !tableEventInitialized.summary) {
        summaryContainer.addEventListener('change', (e) => {
            const type = e.target.dataset.type;
            if (type === 'sched') handleSchedInput(e.target);
            else if (type === 'pattern-cycle') handlePatternCycleInput(e.target);
            else if (type === 'offset') handleOffsetInput(e.target);
            else if (type === 'split-cell') handleSplitInput(e.target);
        });
        summaryContainer.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
        });
        tableEventInitialized.summary = true;
    }

    // 4. ê·¸ë£¹ TOD ?Œì´ë¸?    const groupTodContainer = document.getElementById('group-tod-table-container');
    if (groupTodContainer && !tableEventInitialized.groupTod) {
        groupTodContainer.addEventListener('change', (e) => {
            if (e.target.dataset.type === 'group-sched') handleGroupSchedInput(e.target);
        });
        groupTodContainer.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
        });
        tableEventInitialized.groupTod = true;
    }
}

/**
 * [Phase/Split] ?Œì´ë¸??…ë ¥ ì²˜ë¦¬
 */
function handleTableInput(el) {
    const key = el.dataset.key; // splitA, yellowA ??    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;

    // [Fix] ID ì²´ê³„ ?¼ì›??(krd- ê¸°ë°˜ ì§ì ‘ ì¡°íšŒ)
    let jid = STATE.activeJid;
    if (!jid) return;
    
    const j = STATE.junctions[jid];
    if (!j) {
        console.error(`[DataSync] Cannot find junction: ${jid}`);
        return;
    }

    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const pIdx = parseInt(UI.planIdx?.value) || 0;
    const p = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;

    const smIdx = STATE.currentSignalMapIdx || 0;
    const sm = (j.signalMaps) ? j.signalMaps[smIdx] : null;

    const isSplit = key.startsWith('split');
    const target = isSplit ? p : sm;

    if (key && target && target[key]) {
        target[key][idx] = val;
        console.log(`[Sync] Updated: ${jid} -> ${key}[${idx}] = ${val}`);
    }

    // Dual ëª¨ë“œ ?„ë‹ ???™ê¸°??ë¡œì§
    const chkDual = document.getElementById('chk-dual-ring');
    const isDual = chkDual ? chkDual.checked : true;
    if (!isDual && key && key.endsWith('A')) {
        const bKey = key.replace(/A$/, 'B');
        if (target[bKey]) {
            target[bKey][idx] = val;
            const bEl = document.querySelector(`.sigma-input[data-key="${bKey}"][data-index="${idx}"]`);
            if (bEl) {
                bEl.value = val;
                bEl.classList.toggle('val-zero', val === 0);
                bEl.classList.toggle('val-non-zero', val !== 0);
            }
        }
    }

    // Auto-calculate pedA, pedB and MG
    if (['pedGreenA', 'pedFlashA', 'pedGreenB', 'pedFlashB', 'allredA', 'allredB', 'pedDelayA', 'pedDelayB'].includes(key) || (key.startsWith('split') && !isDual)) {
        if (!sm.pedA) sm.pedA = [0,0,0,0,0,0,0,0];
        if (!sm.pedB) sm.pedB = [0,0,0,0,0,0,0,0];
        
        sm.pedA[idx] = (sm.pedGreenA?.[idx] || 0) + (sm.pedFlashA?.[idx] || 0);
        sm.pedB[idx] = (sm.pedGreenB?.[idx] || 0) + (sm.pedFlashB?.[idx] || 0);
        
        const arA = sm.allredA?.[idx] || 0;
        const dlyA = sm.pedDelayA?.[idx] || 0;
        const mgA = sm.pedA[idx] > 0 ? sm.pedA[idx] + arA + dlyA : 0;
        
        const arB = sm.allredB?.[idx] || 0;
        const dlyB = sm.pedDelayB?.[idx] || 0;
        const mgB = sm.pedB[idx] > 0 ? sm.pedB[idx] + arB + dlyB : 0;
        
        const updateField = (k, v) => {
            const el = document.querySelector(`.calc-field[data-key="${k}"][data-index="${idx}"]`);
            if (el) {
                el.textContent = v;
                el.style.color = v === 0 ? '#4b5563' : '#10b981';
            }
        };
        
        updateField('pedA', sm.pedA[idx]);
        updateField('minGreenA', mgA);
        
        if (isDual || !key.endsWith('A')) {
            updateField('pedB', sm.pedB[idx]);
            updateField('minGreenB', mgB);
        } else if (!isDual && key.endsWith('A')) { // sync B side if dual is off
            updateField('pedB', sm.pedA[idx]); // B takes A's ped logic
            updateField('minGreenB', mgA);
        }
    }

    updateDependentCells(idx, p, sm);
    updateCycleDisplayLocally(p);
}

/**
 * [Mov] ?´ë™ë¥??¤ì • ?…ë ¥ ì²˜ë¦¬
 */
function handleMovInput(el) {
    const key = el.dataset.key; // movA, movB ??    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;

    const j = STATE.junctions[STATE.activeJid];
    if (!j) return;

    // ?„ìž¬ ? íƒ???œì°¨ë§??¹ì? ê¸€ë¡œë²Œ ?°ì´?°ì— ?€??    const smIdx = STATE.currentSignalMapIdx || 0;
    const sm = j.signalMaps ? j.signalMaps[smIdx] : null;

    if (sm) {
        if (!sm[key]) sm[key] = [0,0,0,0,0,0,0,0];
        sm[key][idx] = val;
        // 0ë²?ë§µì¸ ê²½ìš° ë£¨íŠ¸ ?ˆë²¨???™ê¸°??        if (smIdx === 0) { if (!j[key]) j[key] = [0,0,0,0,0,0,0,0]; j[key][idx] = val; }
        if (window.ipdInstance) window.ipdInstance.loadFromSignalMap(sm);
        // ???„ì‹œê³„íš(Map)?€ A/B ë§??…ë¦½ ?…ë ¥ - Dual ?™ê¸°??ë¶ˆí•„??    } else { if (!j[key]) j[key] = [0,0,0,0,0,0,0,0]; j[key][idx] = val; }

    if (typeof refreshVisibleArrows === 'function') refreshVisibleArrows();
    // ë°©í–¥(Dir) ?´ë?ì§€ ê°±ì‹ ???„í•´ ?”ë°”?´ì‹± ë¦¬ë Œ?”ë§
    debounceUpdateRingTables();
}


/**
 * [Sched] ?”ì•½ ?Œì´ë¸??¤ì?ì¤???ë¶? ì£¼ê¸°) ?…ë ¥ ì²˜ë¦¬
 */
function handlePatternCycleInput(el) {
    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;
    
    const j = STATE.junctions[STATE.activeJid];
    if (!j) return;
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    
    if (j.dayPlans && j.dayPlans[dayIdx] && j.dayPlans[dayIdx][idx]) {
        j.dayPlans[dayIdx][idx].cycle = val;
    }
    
    // ë§Œì•½ ?„ìž¬ ?¤ì´?´ê·¸??Ring Table)?????¨í„´??ë³´ì—¬ì£¼ê³  ?ˆë‹¤ë©??…ë°?´íŠ¸
    if (typeof UI !== 'undefined' && UI.planIdx) {
        const pIdx = parseInt(UI.planIdx.value) || 0;
        if (pIdx === idx) {
            debounceUpdateRingTables();
        }
    }
    
    debounceUpdateHeavyUI();
}

function handleSchedInput(el) {
    const field = el.dataset.field; // h, m, cycle
    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;

    const j = STATE.junctions[STATE.activeJid];
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const schedules = (j.group && STATE.groups[j.group])
        ? STATE.groups[j.group].schedules[dayIdx]
        : j.schedules[dayIdx];

    if (schedules && schedules[idx]) {
        schedules[idx][field] = val;
    }

    // ?„ìž¬ ë³´ê³  ?ˆëŠ” ?Œëžœ??ì£¼ê¸°ê°€ ë°”ë€Œì—ˆ?¤ë©´ ?”ë©´ ê°±ì‹ ???„ìš”???•ì¸
    if (idx === parseInt(UI.planIdx.value)) {
        debounceUpdateRingTables();
    }
    debounceUpdateHeavyUI();
}

function handleOffsetInput(el) {
    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;

    STATE.junctions[STATE.activeJid].dayPlans[STATE.currentJunctionDayTypeIdx][idx].offset = val;

    if (idx === parseInt(UI.planIdx.value)) {
        if (UI.todInpOffset) UI.todInpOffset.value = val;
    }
    debounceUpdateHeavyUI();
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}


function handleSplitInput(el) {
    const idx = parseInt(el.dataset.index);
    const ring = el.dataset.ring; // "A" or "B"
    const col = parseInt(el.dataset.col); // 0 to 7
    const val = parseInt(el.value, 10) || 0;
    
    if (typeof STATE !== 'undefined' && STATE.activeJid) {
        const j = STATE.junctions[STATE.activeJid];
        if (j && j.dayPlans && j.dayPlans[STATE.currentJunctionDayTypeIdx]) {
            if (ring === 'A') {
                j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].splitA[col] = val;
                // Auto-update cycle based on Ring A sum (User Request)
                const sumA = j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].splitA.reduce((a, b) => a + b, 0);
                j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].cycle = Math.round(sumA);
                if (j.schedules && j.schedules[STATE.currentJunctionDayTypeIdx] && j.schedules[STATE.currentJunctionDayTypeIdx][idx]) {
                    j.schedules[STATE.currentJunctionDayTypeIdx][idx].cycle = Math.round(sumA);
                }
                // Update UI instantly
                const cycleInput = document.querySelector(`input[data-type="pattern-cycle"][data-index="${idx}"]`);
                if (cycleInput) {
                    cycleInput.value = Math.round(sumA);
                    cycleInput.style.background = '';
                    cycleInput.style.border = '';
                    cycleInput.style.color = 'var(--accent)';
                }
            } else if (ring === 'B') {
                j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].splitB[col] = val;
            }
            
            // ë§Œì•½ ?¸ì§‘ì¤‘ì¸ ?¬ë¡¯???„ìž¬ ?ë‹¨??ë¡œë“œ???¬ë¡¯ê³?ê°™ë‹¤ë©? ?ë‹¨ UI(ë§??Œì´ë¸???ì¦‰ì‹œ ?™ê¸°??            if (typeof UI !== 'undefined' && UI.planIdx && parseInt(UI.planIdx.value) === idx) {
                if (typeof renderRingTables === 'function') renderRingTables();
            }
        }
    }
    
    debounceUpdateHeavyUI();
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}


/**
 * [GroupSched] ê·¸ë£¹ TOD ?Œì´ë¸??…ë ¥ ì²˜ë¦¬
 */
function handleGroupSchedInput(el) {
    const field = el.dataset.field; // h, m, cycle
    const idx = parseInt(el.dataset.idx);
    const dayIdx = parseInt(el.dataset.day);
    const val = parseInt(el.value) || 0;

    if (typeof currentEditingGroup === 'undefined' || !currentEditingGroup) return;
    const group = STATE.groups[currentEditingGroup];
    if (!group || !group.schedules) return;

    group.schedules[dayIdx][idx][field] = val;

    // [ì¤‘ìš”] ê°œë³„ êµì°¨ë¡œê? ? íƒ???íƒœ?¼ë©´ ?´ë‹¹ êµì°¨ë¡œì˜ schedule?ë„ ì¦‰ì‹œ ?™ê¸°??    if (typeof STATE !== 'undefined' && STATE.activeJid && STATE.junctions[STATE.activeJid]) {
        const j = STATE.junctions[STATE.activeJid];
        if (String(j.group) === String(currentEditingGroup)) {
            if (j.schedules && j.schedules[dayIdx] && j.schedules[dayIdx][idx]) {
                j.schedules[dayIdx][idx][field] = val;
            }
        }
    }

    // ì°¨íŠ¸ ë°?ê¸°í? UI ?…ë°?´íŠ¸ (?”ë°”?´ì‹±)
    debounceUpdateGroupUI();

    // ?„ìž¬ ë³´ê³  ?ˆëŠ” ?”ì¼???¸ì§‘ ì¤‘ì¸ ?”ì¼?´ë¼ë©??µê³„ ?±ë„ ê°±ì‹  ?„ìš”?????ˆìŒ
    if (dayIdx === STATE.currentGroupDayTypeIdx) {
        debounceUpdateHeavyUI();
    }
}

let groupUiTimeout = null;
function debounceUpdateGroupUI() {
    if (groupUiTimeout) clearTimeout(groupUiTimeout);
    groupUiTimeout = setTimeout(() => {
        if (typeof renderGroupCycleChart === 'function') renderGroupCycleChart();
        if (document.getElementById('tab-stats').classList.contains('active') && typeof renderStats === 'function') {
            renderStats();
        }
    }, 1000);
}

/**
 * Green ?¤ì‹œê°??…ë°?´íŠ¸
 */
function updateDependentCells(i, p, sm) {
    const greenA = p.splitA[i] - (p.allredA[i] || 0) - (p.yellowA[i] || 0);
    const greenB = p.splitB[i] - (p.allredB[i] || 0) - (p.yellowB[i] || 0);

    const gAEl = document.getElementById(`val-greenA-${i}`);
    const gBEl = document.getElementById(`val-greenB-${i}`);

    if (gAEl) gAEl.innerText = greenA;
    if (gBEl) gBEl.innerText = greenB;

    // [New] ?¤ì‹œê°??ˆì „ ê°ì‚¬ (MG ì²´í¬)
    if (!sm) return;
    ['A', 'B'].forEach(ring => {
        const splitKey = 'split' + ring;
        const val = p[splitKey][i];
        if (val <= 0) return; // ë¯¸ì‚¬???„ì‹œ???œì™¸

        const ped = sm['ped' + ring]?.[i] || 0;
        const arr = sm['allred' + ring]?.[i] || 0;
        const dly = sm['pedDelay' + ring]?.[i] || 0;
        const yel = sm['yellow' + ring]?.[i] || 0;

        const mg = ped > 0 ? ped + dly + arr : 0;
        const mgWithYellow = mg + yel;

        const el = document.querySelector(`.sigma-input.inp-${splitKey}[data-index="${i}"]`);
        if (el) {
            if (val < mg) {
                // [1?¨ê³„] ?„ê¸° (Red)
                el.style.border = '2px solid #ff4d4d';
                el.style.boxShadow = '0 0 10px rgba(255,77,77,0.5)';
                el.style.background = 'rgba(255,77,77,0.15)';
                el.style.color = '#ff4d4d';
                el.style.fontWeight = 'bold';
                el.title = `?ˆì „ê°ì‚¬ ?„ê¸°! ìµœì†Œ?¹ìƒ‰?œê°„(${mg}ì´? ë¯¸ë‹¬`;
            } else if (val < mgWithYellow) {
                // [2?¨ê³„] ì£¼ì˜ (Yellow)
                el.style.border = '2px solid #ffcc00';
                el.style.boxShadow = '0 0 10px rgba(255,204,0,0.5)';
                el.style.background = 'rgba(255,204,0,0.1)';
                el.style.color = '#ffcc00';
                el.style.fontWeight = 'bold';
                el.title = `?ˆì „ê°ì‚¬ ì£¼ì˜! ìµœì†Œ?¹ìƒ‰+?©ìƒ‰(${mgWithYellow}ì´? ë¯¸ë‹¬`;
            } else {
                // [3?¨ê³„] ?•ìƒ
                el.style.border = '';
                el.style.boxShadow = '';
                el.style.background = '';
                el.style.color = '';
                el.style.fontWeight = '';
                el.title = '';
            }
        }
    });
}

/**
 * ì£¼ê¸° ?¼ì¹˜ ?¬ë? ?¤ì‹œê°??…ë°?´íŠ¸
 */
function updateCycleDisplayLocally(p) {
    const sA = p.splitA.reduce((a, b) => a + b, 0);
    const sB = p.splitB.reduce((a, b) => a + b, 0);

    const j = STATE.junctions[STATE.activeJid];
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const pIdx = parseInt(UI.planIdx?.value) || 0;
    const s = (j && j.schedules) ? (getLinkedSchedule(j, dayIdx)?.[pIdx] || { cycle: 100 }) : { cycle: 100 };
    const target = p.cycle || 100;

    const isMatch = (sA === target && sB === target);
    const cycInp = document.getElementById('tod-inp-cycle');
    if (cycInp) cycInp.style.color = isMatch ? '#00ff88' : '#ff4444';
}

let heavyUiTimeout = null;
function debounceUpdateHeavyUI() {
    if (heavyUiTimeout) clearTimeout(heavyUiTimeout);
    heavyUiTimeout = setTimeout(() => {
        // [?˜ì •] ?„ìž¬ ?¬ì»¤?¤ê? ?”ì•½ ?Œì´ë¸??´ë????…ë ¥ì°½ì— ?ˆë‹¤ë©?ë¦¬ë Œ?”ë§????ë²???ì§€??(?…ë ¥ ë°©í•´ ë°©ì?)
        const activeEl = document.activeElement;
        if (activeEl && activeEl.closest('#tod-summary-container')) {
            debounceUpdateHeavyUI();
            return;
        }

        renderSummaryTable();
        if (document.getElementById('tab-stats').classList.contains('active') && typeof renderStats === 'function') {
            renderStats();
        }
    }, 1000); // 1ì´ˆë¡œ ?½ê°„ ?˜ë¦¼
}

let ringTableTimeout = null;
function debounceUpdateRingTables() {
    if (ringTableTimeout) clearTimeout(ringTableTimeout);
    ringTableTimeout = setTimeout(() => {
        // renderRingTables()ë¥??¸ì¶œ?˜ë˜, ?¤ì‹œ init ?¸ë“¤?¬ë? ì¤‘ë³µ?¤í–‰?˜ì? ?Šë„ë¡??´ë? flagê°€ ê´€ë¦¬í•¨
        if (typeof renderRingTables === 'function') renderRingTables();
    }, 1500);
}

/**
 * ë°©í–¥???´ë¹„ê²Œì´??(ê°?ë³€ê²?ê¸ˆì? ë°??€ ?´ë™)
 */
function handleTableKeyNavigation(e) {
    const key = e.key;
    const input = e.target;
    const td = input.closest('td');
    if (!td) return;

    const tr = td.closest('tr');
    if (!tr) return;

    // ?„ìž¬ ?‰ì˜ ëª¨ë“  ?…ë ¥??ë°°ì—´ë¡?ê°€?¸ì˜´ (ì¢????´ë™??
    const inputsInRow = Array.from(tr.querySelectorAll('input.sigma-input'));
    const currentInputIdx = inputsInRow.indexOf(input);

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault(); // ê¸°ë³¸ ê°?ë³€ê²??™ìž‘ ë°©ì?

        let targetInput = null;

        if (key === 'ArrowLeft') {
            if (currentInputIdx > 0) {
                targetInput = inputsInRow[currentInputIdx - 1];
            }
        } else if (key === 'ArrowRight') {
            if (currentInputIdx < inputsInRow.length - 1) {
                targetInput = inputsInRow[currentInputIdx + 1];
            }
        } else if (key === 'ArrowUp' || key === 'ArrowDown') {
            // ???„ëž˜ ?´ë™?€ ?™ì¼??TD ?´ì˜ ëª?ë²ˆì§¸ input?¸ì? ?Œì•…?˜ì—¬ ?´ë™
            const inputsInCell = Array.from(td.querySelectorAll('input.sigma-input'));
            const inputIdxInCell = inputsInCell.indexOf(input);
            const colIdx = Array.from(tr.cells).indexOf(td);

            const targetTr = (key === 'ArrowUp') ? tr.previousElementSibling : tr.nextElementSibling;
            if (targetTr) {
                const targetTd = targetTr.cells[colIdx];
                if (targetTd) {
                    const targetCellInputs = Array.from(targetTd.querySelectorAll('input.sigma-input'));
                    targetInput = targetCellInputs[inputIdxInCell] || targetCellInputs[0];
                }
            }
        }

        if (targetInput) {
            targetInput.focus();
            targetInput.select();
        }
    }
}

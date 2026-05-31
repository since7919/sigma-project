/**
 * stats.js
 * ─────────────────────────────────────────────
 * 통계 렌더링, Chart.js 래퍼, 운영통계 테이블,
 * 교차로 통계 테이블
 * 의존: config.js, utils.js, ui.js
 */

let charts = {};

/* ══════════════════════════════════════════
 *  운영통계 확장/축소 토글
 * ══════════════════════════════════════════ */
function toggleOpStatsExpand() {
    STATE.isOpStatsExpanded = !STATE.isOpStatsExpanded;
    const btn = document.getElementById('btn-op-expand');
    if (btn) btn.innerHTML = STATE.isOpStatsExpanded ? '📐 방향 축소 (8→4)' : '📐 방향 확장 (4→8)';
    if (STATE.activeJid) renderOpStatsTable();
}

/* ══════════════════════════════════════════
 *  방향별 운영통계 테이블 렌더링
 * ══════════════════════════════════════════ */
function renderOpStatsTable() {
    const jid = STATE.activeJid;
    const j = jid ? STATE.junctions[jid] : { opStatsDetailed: { directional: {}, global: {} } };
    const opDetailed = j.opStatsDetailed || { directional: {}, global: {} };
    
    // [Auto-Fill] 보행점멸 시간을 이용한 횡단보도 길이 자동 매핑 (Map 0 기준)
    if (j.signalMaps && j.signalMaps[0]) {
        const sm0 = j.signalMaps[0];
        const pedFlashMap = {
            'N': sm0.pedFlashB ? sm0.pedFlashB[0] : 0, // 북측: B링 1현시 점멸
            'S': sm0.pedFlashA ? sm0.pedFlashA[0] : 0, // 남측: A링 1현시 점멸
            'E': sm0.pedFlashA ? sm0.pedFlashA[2] : 0, // 동측: A링 3현시 점멸
            'W': sm0.pedFlashB ? sm0.pedFlashB[2] : 0  // 서측: B링 3현시 점멸
        };

        Object.entries(pedFlashMap).forEach(([dir, val]) => {
            if (val > 0) {
                // 값이 비어있거나 0인 경우에만 자동 채우기
                const key = `cwVA-${dir}`;
                if (!opDetailed.directional[key] || opDetailed.directional[key] == 0) {
                    opDetailed.directional[key] = val;
                }
            }
        });
    }

    const isExpanded = STATE.isOpStatsExpanded;

    const directions = isExpanded
        ? ["N", "L1", "E", "L2", "S", "L3", "W", "L4"]
        : ["N", "E", "S", "W"];
    const dirLabels = { "N": "북", "E": "동", "S": "남", "W": "서", "L1": "북동", "L2": "동남", "L3": "서남", "L4": "서북" };

    const thead = document.getElementById('op-stats-thead');
    const tbody = document.getElementById('op-stats-tbody');
    const table = document.getElementById('op-stats-table');
    const container = document.getElementById('op-stats-container');
    const topScrollCon = document.getElementById('op-stats-top-scroll-container');
    const topScrollContent = document.getElementById('op-stats-top-scroll-content');

    if (isExpanded) {
        table.style.width = '1100px';
        topScrollCon.style.display = 'block';
        topScrollContent.style.width = '1100px';
    } else {
        table.style.width = '100%';
        topScrollCon.style.display = 'none';
    }
    table.style.tableLayout = 'fixed';

    // 스크롤 동기화 및 입력 감지 (한 번만)
    if (!container.dataset.syncInit) {
        container.onscroll = () => { topScrollCon.scrollLeft = container.scrollLeft; };
        topScrollCon.onscroll = () => { container.scrollLeft = topScrollCon.scrollLeft; };

        table.oninput = (e) => {
            if (typeof syncActiveJunctionData === 'function') {
                syncActiveJunctionData();
            }
        };

        container.dataset.syncInit = "true";
    }

    // Head
    let headHtml = `<tr style="background: rgba(30, 39, 46, 0.8); color: #1abc9c;">
        <th style="padding: 6px; border: 1px solid rgba(255,255,255,0.05); width: 85px; font-size:12px; color: #1abc9c;">운영항목</th>`;
    directions.forEach(d => {
        headHtml += `<th style="padding: 4px; border: 1px solid rgba(255,255,255,0.05); font-size:11.5px; width: ${isExpanded ? '125px' : 'auto'}; color: #a5b1be;">${dirLabels[d]}</th>`;
    });
    headHtml += `</tr>`;
    thead.innerHTML = headHtml;

    // Body
    tbody.innerHTML = '';

    // 셀 생성 헬퍼 (createStyledNumInput / createStyledChkInput 대신 로컬 헬퍼 사용)
    const createNumInput = (row, dir, value, label, width) => {
        label = label || ""; width = width || "35px";
        return `
            <div style="display:flex; align-items:center; gap:3px;">
                ${label ? `<span style="font-size:10px; color:#7f8c8d; min-width:21px; text-align:right;">${label}</span>` : ''}
                <input type="number" class="inp-op-det-num" data-row="${row}" data-dir="${dir}" value="${value}" 
                       style="width:${width}; border:none; background:rgba(45, 52, 54, 0.6); color:#ced4da; text-align:center; font-size:11px; height:20px; outline:none; border-radius:3px;">
            </div>`;
    };

    const createChkInput = (row, dir, label, title) => {
        const val = opDetailed.directional[`${row}-${dir}`];
        const isChecked = (val === true || val === 1 || val === "true") ? 'checked' : '';
        return `
            <label title="${title || label}" style="display:flex; align-items:center; gap:4px; white-space:nowrap; font-size:11px; cursor:pointer; color:#95a5a6; padding:2px 4px; border-bottom:1px solid rgba(255,255,255,0.02); transition: color 0.2s;">
                <input type="checkbox" class="inp-op-det-chk" data-row="${row}" data-dir="${dir}" ${isChecked} style="width:13px; height:13px; opacity: 0.7;">${label}
            </label>`;
    };

    // 접기/펼치기 핸들러 (글로벌 함수로 등록)
    const toggleCategory = (catId) => { STATE.opStatsFolded[catId] = !STATE.opStatsFolded[catId]; renderOpStatsTable(); };
    window.toggleOpStatsCategory = toggleCategory;

    const toggleColB = (catId) => { STATE.opStatsColBMap[catId] = !STATE.opStatsColBMap[catId]; renderOpStatsTable(); };
    window.toggleOpStatsColB = toggleColB;

    // 섹션 헤더 렌더링 헬퍼
    const renderSectionHeader = (label, color) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${directions.length + 1}" style="padding:10px 15px; background:rgba(0, 212, 255, 0.1); color:${color || '#00d4ff'}; font-weight:900; font-size:13px; letter-spacing:1px; border:1px solid rgba(0, 212, 255, 0.2);">${label}</td>`;
        tbody.appendChild(tr);
    };

    const renderDirectionalRow = (rowLabel, catId, type) => {
        const isFolded = STATE.opStatsFolded[catId];
        const showColB = STATE.opStatsColBMap[catId];
        const hasColB = (type === 'lane');

        // Row Header
        const trHeader = document.createElement('tr');
        trHeader.style.cursor = 'pointer';
        trHeader.style.background = 'rgba(47, 53, 66, 0.4)';
        trHeader.innerHTML = `
            <td colspan="${directions.length + 1}" style="padding:6px 10px; text-align:left; border:1px solid rgba(255,255,255,0.03); color:#2ecc71; font-weight:bold; font-size:12px;" onclick="toggleOpStatsCategory('${catId}')">
                <span style="display:inline-block; width:12px; transform:${isFolded ? 'rotate(-90deg)' : 'none'}; transition:0.2s;">▼</span> ${rowLabel}
                ${hasColB ? `<span onclick="event.stopPropagation(); toggleOpStatsColB('${catId}')" style="margin-left:15px; color:#7f8c8d; font-size:10px; font-weight:normal; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:3px; border: 1px solid rgba(255,255,255,0.1);">
                    ${showColB ? '◀ 기본A만 보기' : '▶ 기본B 포함'}</span>` : ''}
            </td>
        `;
        tbody.appendChild(trHeader);

        if (isFolded) return;

        // Data Row
        const trData = document.createElement('tr');
        trData.style.background = 'rgba(30, 39, 46, 0.2)';
        let html = `<td style="background:rgba(30, 39, 46, 0.5); color:#95a5a6; border:1px solid rgba(255,255,255,0.03); padding:10px; font-weight:bold; font-size:11px; text-align:center;">${rowLabel}</td>`;

        directions.forEach(d => {
            let cellContent = `<div style="display:flex; flex-direction:column; gap:1px; padding:2px;">`;
            if (type === 'lane') {
                const laneItems = [
                    { keyA: 'laneLA', keyB: 'laneLB', lblA: '좌A', lblB: '좌B' },
                    { keyA: 'laneSA', keyB: 'laneSB', lblA: '직A', lblB: '직B' },
                    { keyA: 'laneRA', keyB: 'laneRB', lblA: '우A', lblB: '우B' }
                ];
                laneItems.forEach(item => {
                    cellContent += `<div style="display:flex; gap:4px; margin-bottom:2px;">`;
                    cellContent += createNumInput(item.keyA, d, opDetailed.directional[`${item.keyA}-${d}`] || 0, item.lblA);
                    if (showColB) cellContent += createNumInput(item.keyB, d, opDetailed.directional[`item.keyB}-${d}`] || 0, item.lblB);
                    cellContent += `</div>`;
                });
            } else if (type === 'facility') {
                // 도로시설: 보행(m), 보조 등
                cellContent += `<div style="display:flex; gap:4px; margin-bottom:4px;">`;
                cellContent += createNumInput('cwVA', d, opDetailed.directional[`cwVA-${d}`] || 0, '보행A', '40px');
                cellContent += createNumInput('cwVB', d, opDetailed.directional[`cwVB-${d}`] || 0, '보행B', '40px');
                cellContent += `</div>`;
                [['cwAuxA', '보조등A'], ['cwAuxB', '보조등B'], ['cwDiag', '대각선'], ['cwTwo', '이단(2단)']].forEach(o => cellContent += createChkInput(o[0], d, o[1]));
            } else if (type === 'pedOps') {
                // 신호운영: 보행신호 관련
                [['cwLag', '보행시차'], ['cwLpi', 'LPI'], ['cwMulti', '다회보행'], ['cwSpd10', '1.0m/s'], ['cwSpd07', '0.7m/s'], ['cwChild', '어린이'], ['cwOld', '노인'], ['cwDis', '장애인'], ['cwRes1', '예비1'], ['cwRes2', '예비2']].forEach(o => cellContent += createChkInput(o[0], d, o[1]));
            } else if (type === 'left') {
                [['leftProt', '보호'], ['leftUnprot', '비보호'], ['leftPplt', 'PPLT'], ['leftPdlt', 'PDLT'], ['leftRes1', '예비1'], ['leftRes2', '예비2']].forEach(o => cellContent += createChkInput(o[0], d, o[1]));
            } else if (type === 'right') {
                [['rightSig', '신호등'], ['rightAux', '보조등'], ['rightRes1', '예비1'], ['rightRes2', '예비2']].forEach(o => cellContent += createChkInput(o[0], d, o[1]));
            } else if (type === 'act') {
                // 감응 및 기타 운영
                cellContent += `<div style="color:#bdc3c7; font-size:9px; margin-bottom:3px; border-bottom:1px solid #444;">감응 제어</div>`;
                [['actSkip', '현시생략'], ['actEarly', '조기종결'], ['actMax', '최대시간'], ['actLeadL', '선좌'], ['actLeadS', '선직']].forEach(o => cellContent += createChkInput(o[0], d, o[1]));
                cellContent += `<div style="color:#bdc3c7; font-size:9px; margin-top:5px; margin-bottom:3px; border-bottom:1px solid #444;">기타 제어</div>`;
                [['spaceWait', '대기공간'], ['spaceCongest', '앞막힘']].forEach(o => cellContent += createChkInput(o[0], d, o[1]));
            }
            cellContent += `</div>`;
            html += `<td style="border:1px solid rgba(255,255,255,0.05); vertical-align:top; background:rgba(0,0,0,0.1);">${cellContent}</td>`;
        });
        trData.innerHTML = html;
        tbody.appendChild(trData);
    };

    // [섹션 1] 도로시설
    renderSectionHeader('🏗️ 도로시설 (Road Facilities)');
    renderDirectionalRow('차로수 현황 (기본A/B)', 'laneCount', 'lane');
    renderDirectionalRow('횡단보도 및 보조 시설', 'cwFacility', 'facility');

    // [섹션 2] 신호운영
    renderSectionHeader('🚦 신호운영 (Signal Operations)');
    renderDirectionalRow('보행 신호 운영', 'pedOps', 'pedOps');
    renderDirectionalRow('좌회전 신호 운영', 'leftTurn', 'left');
    renderDirectionalRow('우회전 신호 운영', 'rightTurn', 'right');
    renderDirectionalRow('감응 및 기타 제어', 'actOps', 'act');
}

/* ══════════════════════════════════════════
 *  교차로 통계 테이블
 * ══════════════════════════════════════════ */
function renderJunctionStatsTable() {
    const jid = STATE.activeJid;
    const j = jid ? STATE.junctions[jid] : { controller: '-' };
    const opDetailed = j.opStatsDetailed || { directional: {}, global: {} };
    const tbody = document.getElementById('j-stats-tbody');

    tbody.innerHTML = '';
    tbody.oninput = () => {
        if (typeof syncActiveJunctionData === 'function') syncActiveJunctionData();
    };

    const createGlobalChkInput = (key, label) => {
        const isChecked = (opDetailed.global && opDetailed.global[key]) ? 'checked' : '';
        return `
            <label style="display:flex; align-items:center; gap:4px; white-space:nowrap; font-size:11px; cursor:pointer; color:#95a5a6; padding:1px 4px;">
                <input type="checkbox" class="inp-op-global" data-key="${key}" ${isChecked} style="width:13px; height:13px; opacity: 0.8;">${label}
            </label>`;
    };

    const renderJStatsRow = (label, items) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
        tr.innerHTML = `
            <td style="padding:8px 10px; background:rgba(30, 39, 46, 0.5); color:#a5b1be; font-weight:bold; border:1px solid rgba(255,255,255,0.03); width:85px;">${label}</td>
            <td style="padding:4px; border:1px solid rgba(255,255,255,0.03);">
                <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:2px;">
                    ${items.map(it => createGlobalChkInput(it[0], it[1])).join('')}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    };

    const renderJStatsTextRow = (label, value) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
        tr.innerHTML = `
            <td style="padding:8px 10px; background:rgba(30, 39, 46, 0.5); color:#a5b1be; font-weight:bold; border:1px solid rgba(255,255,255,0.03); width:85px;">${label}</td>
            <td style="padding:4px 10px; border:1px solid rgba(255,255,255,0.03); color:var(--accent); font-size:11.5px; font-weight:bold;">${value || '-'}</td>
        `;
        tbody.appendChild(tr);
    };

    renderJStatsRow('접근로', [['app-1', '단일'], ['app-3', '3지'], ['app-4', '4지'], ['app-5', '5지'], ['app-6plus', '6지+']]);
    renderJStatsRow('보호구역', [['zone-child', '어린이'], ['zone-old', '노인'], ['zone-disabled', '장애인']]);
    renderJStatsTextRow('제어기', j.controller);
    renderJStatsRow('보행신호', [['ped-diagonal', '대각선'], ['ped-full', '동시_전일'], ['ped-time', '동시_시간'], ['ped-two', '이단'], ['ped-lag', '보행시차'], ['ped-lpi', 'LPI'], ['ped-multi', '다회보행']]);
    renderJStatsRow('점멸신호', [['flash-full', '전일'], ['flash-time', '시간'], ['flash-etc', '기타']]);
    renderJStatsRow('긴급신호', [['emg-st', '소방서'], ['emg-tr', '소방차']]);
    renderJStatsRow('기타', [['etc-r1', '운영자개입'], ['etc-r2', '예비1'], ['etc-r3', '예비2']]);
}

/** [추가] 관리청/경찰서 필터 드롭다운 동적 생성 */
function updateStatFilters() {
    const officeSel = document.getElementById('stat-office-filter');
    const policeSel = document.getElementById('stat-police-filter');
    if (!officeSel || !policeSel) return;

    const junctions = Object.values(STATE.junctions);
    const offices = [...new Set(junctions.map(j => (j.office || "").trim()).filter(Boolean))].sort();
    const polices = [...new Set(junctions.map(j => (j.police || "").trim()).filter(Boolean))].sort();

    // 갱신 여부 체크: 옵션 개수가 다르면 갱신 (초기화 방지)
    if (officeSel.options.length === offices.length + 1 && policeSel.options.length === polices.length + 1) {
        return; 
    }

    const currentOffice = officeSel.value;
    const currentPolice = policeSel.value;

    officeSel.innerHTML = '<option value="ALL">전체 관리청</option>';
    offices.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o; opt.innerText = o;
        officeSel.appendChild(opt);
    });
    officeSel.value = offices.includes(currentOffice) ? currentOffice : 'ALL';

    policeSel.innerHTML = '<option value="ALL">전체 경찰서</option>';
    polices.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.innerText = p;
        policeSel.appendChild(opt);
    });
    policeSel.value = polices.includes(currentPolice) ? currentPolice : 'ALL';
}

/* ══════════════════════════════════════════
 *  전체 통계 렌더링
 * ══════════════════════════════════════════ */
function renderStats() {
    // [추가] 필터 업데이트 (최초 로드 시나 데이터 변경 시 대응)
    updateStatFilters();

    let junctions = Object.values(STATE.junctions);
    
    // [추가] 필터 적용
    const officeFilter = document.getElementById('stat-office-filter')?.value || 'ALL';
    if (officeFilter !== 'ALL') {
        junctions = junctions.filter(j => (j.office || "").trim() === officeFilter);
    }
    const policeFilter = document.getElementById('stat-police-filter')?.value || 'ALL';
    if (policeFilter !== 'ALL') {
        junctions = junctions.filter(j => (j.police || "").trim() === policeFilter);
    }

    const jids = junctions.map(j => j.id);
    if (document.getElementById('stat-no-data')) document.getElementById('stat-no-data').style.display = 'none';
    if (document.getElementById('stat-content')) document.getElementById('stat-content').style.display = 'block';
    
    document.getElementById('stat-total-count').innerText = jids.length.toLocaleString();

    const totalPlans = jids.length * 10;
    let activePlansCount = 0;
    
    junctions.forEach(j => {
        if (j.schedules) {
            j.schedules.forEach(sched => {
                if (sched && sched[0] && sched[0].h >= 0) activePlansCount++;
            });
        }
    });

    if (document.getElementById('stat-total-plans')) 
        document.getElementById('stat-total-plans').innerText = totalPlans.toLocaleString();
    if (document.getElementById('stat-active-plans')) 
        document.getElementById('stat-active-plans').innerText = activePlansCount.toLocaleString();

    // [추가] 6개 통계 타일을 위한 데이터 계산
    // [수정] 필터링된 교차로들이 속한 그룹 수만 계산
    const totalGroups = new Set(junctions.map(j => j.group).filter(g => g && g !== 0)).size;
    const civilCount = (STATE.civilData && STATE.civilData.length) ? STATE.civilData.length : 0;
    
    let totalComplexity = 0;
    let complexCount = 0;
    junctions.forEach(j => {
        if (j.signalMaps && j.signalMaps[0]) {
            const m = j.signalMaps[0];
            const movements = (m.movA ? m.movA.filter(v => v > 0).length : 0) + 
                            (m.movB ? m.movB.filter(v => v > 0).length : 0);
            // 대략적인 복잡도 산출 (이동류 수 기반)
            totalComplexity += (movements / 4); // 4지 기준 가중치
            complexCount++;
        }
    });
    const avgComplexity = complexCount > 0 ? (totalComplexity / complexCount).toFixed(1) : "0.0";

    if (document.getElementById('stat-total-groups')) 
        document.getElementById('stat-total-groups').innerText = totalGroups.toLocaleString();
    if (document.getElementById('stat-avg-complexity')) 
        document.getElementById('stat-avg-complexity').innerText = avgComplexity;
    if (document.getElementById('stat-civil-count')) 
        document.getElementById('stat-civil-count').innerText = civilCount.toLocaleString();

    const pIdx = parseInt(UI.planIdx.value) || 0;

    // 선택된 요일 인덱스
    const selectedDayIndices = Array.from(document.querySelectorAll('.stat-day-chk:checked')).map(el => parseInt(el.value));
    if (selectedDayIndices.length === 0) selectedDayIndices.push(0);
    const primaryDayIdx = selectedDayIndices[0];

    // 1. 시간대별 데이터 매트릭스 (5일 x 24시간)
    const cycleMatrix = Array.from({ length: 5 }, () => Array(24).fill(0));
    const cycleCountMatrix = Array.from({ length: 5 }, () => Array(24).fill(0));

    for (let dIdx = 0; dIdx < 5; dIdx++) {
        for (let h = 0; h < 24; h++) {
            const sec = h * 3600;
            junctions.forEach(j => {
                const sched = getLinkedSchedule(j, dIdx) || j.schedules[dIdx];
                const activeIdx = findActiveSchedIdx(sched, sec);
                const activeSched = sched[activeIdx];
                if (activeSched) {
                    const c = activeSched.cycle || 100;
                    if (c > 0) { cycleMatrix[dIdx][h] += c; cycleCountMatrix[dIdx][h]++; }
                }
            });
        }
    }

    // 테이블 렌더링 (SigmaUI 사용)
    const statRows = [];
    for (let dIdx = 0; dIdx < 5; dIdx++) {
        const cells = [
            { content: DAY_LABELS[dIdx], style: 'background:rgba(26, 188, 156, 0.1); font-weight:bold; color:#ccc; white-space: nowrap;' }
        ];
        for (let h = 0; h < 24; h++) {
            const cnt = cycleCountMatrix[dIdx][h];
            const val = cnt > 0 ? Math.round(cycleMatrix[dIdx][h] / cnt) : '-';
            cells.push({
                content: val,
                style: `padding: 6px 0; color: ${val === '-' ? '#444' : 'var(--accent)'}; font-weight: ${val === '-' ? 'normal' : 'bold'}; font-size: 11.5px; white-space: nowrap; text-align: center;`
            });
        }
        statRows.push({ cells });
    }

    SigmaUI.renderTable('stat-cycle-avg-container', {
        tableId: 'stat-cycle-avg-table',
        className: 'sigma-table',
        style: 'font-size: 11px; table-layout: fixed; width: 1100px; min-width: 1100px;',
        head: [
            { label: '구분', style: 'width:80px; padding: 6px 4px; white-space: nowrap; text-align: center; background: rgba(30,39,46,0.8);' },
            ...Array.from({ length: 24 }, (_, i) => ({ 
                label: i + '시', 
                style: 'width:42px; padding: 6px 0; white-space: nowrap; text-align: center; background: rgba(30,39,46,0.5);' 
            }))
        ],
        rows: statRows
    });

    // 2. 주기 분포 계산
    const selectedHour = parseInt(document.getElementById('stat-hour-select')?.value) || 12;
    const targetSec = selectedHour * 3600;
    const cycleRangeLabels = Array.from({ length: 21 }, (_, i) => 50 + i * 10);

    const distDatasets = selectedDayIndices.map(dIdx => {
        const cycleCounts = Array(cycleRangeLabels.length).fill(0);
        junctions.forEach(j => {
            const sched = getLinkedSchedule(j, dIdx) || j.schedules[dIdx];
            const activeIdx = findActiveSchedIdx(sched, targetSec);
            const activeSched = sched[activeIdx];
            const c = activeSched ? (activeSched.cycle || 100) : 100;
            if (c >= 50 && c <= 250) {
                const bucket = Math.round((c - 50) / 10);
                if (bucket >= 0 && bucket < cycleCounts.length) cycleCounts[bucket]++;
            }
        });
        return { label: DAY_LABELS[dIdx], data: cycleCounts, backgroundColor: DAY_COLORS[dIdx], borderColor: 'transparent', borderWidth: 0 };
    });

    updateChart('chart-cycle-dist', 'bar', { labels: cycleRangeLabels.map(l => l + 's'), datasets: distDatasets });

    // 3. 시간대별 평균 주기 그래프
    const lineDatasets = selectedDayIndices.map(dIdx => {
        const hourlyAvgs = Array(24).fill(0);
        for (let h = 0; h < 24; h++) {
            const cnt = cycleCountMatrix[dIdx][h];
            hourlyAvgs[h] = cnt > 0 ? cycleMatrix[dIdx][h] / cnt : 0;
        }
        return {
            label: DAY_LABELS[dIdx], data: hourlyAvgs, borderColor: DAY_COLORS[dIdx],
            backgroundColor: DAY_COLORS_LIGHT[dIdx], fill: selectedDayIndices.length === 1, tension: 0.3
        };
    });

    updateChart('chart-hourly-avg', 'line', {
        labels: Array(24).fill(0).map((_, i) => i + '시'),
        datasets: lineDatasets
    }, { yMin: 0, yStep: 10, legend: { display: selectedDayIndices.length > 1 } });

    // 4. 지표 계산
    let totalMovs = 0, totalPhases = 0, balanceScore = 0, offsetDev = 0;
    junctions.forEach(j => {
        const plan = (j.dayPlans && j.dayPlans[primaryDayIdx]) ? j.dayPlans[primaryDayIdx][pIdx] : null;
        if (!plan) return;
        const activePhases = (plan.splitA || []).filter(s => s > 0).length;
        const activeMovs = [...new Set([...j.movA, ...j.movB])].filter(m => m > 0).length;
        totalPhases += activePhases;
        totalMovs += activeMovs;
        const sumA = plan.splitA.reduce((a, b) => a + b, 0);
        const sumB = plan.splitB.reduce((a, b) => a + b, 0);
        if (sumA > 0) balanceScore += (1 - Math.abs(sumA - sumB) / sumA);
        offsetDev += plan.offset;
    });

    const avgCompVal = (totalMovs / (totalPhases || 1)).toFixed(2);
    document.getElementById('insight-complexity').innerText = avgCompVal;
    if (document.getElementById('stat-avg-complexity')) document.getElementById('stat-avg-complexity').innerText = avgCompVal;
    
    document.getElementById('insight-balance').innerText = ((balanceScore / (jids.length || 1)) * 100).toFixed(1) + "%";
    document.getElementById('insight-diversity').innerText = "보통 (72%)";
    document.getElementById('insight-offset').innerText = (offsetDev / (jids.length || 1)).toFixed(1) + "s";

    // 6개 타일 최종 동기화
    if (document.getElementById('stat-total-groups')) 
        document.getElementById('stat-total-groups').innerText = Object.keys(STATE.groups).length.toLocaleString();
    
    // [수정] 특수 보호구역 수 산출 (어린이, 노인, 장애인 보호구역 통합)
    let specialZoneCount = 0;
    junctions.forEach(j => {
        if (j.optimizerState && j.optimizerState.summary) {
            const s = j.optimizerState.summary;
            if (s['zone-child'] || s['zone-old'] || s['zone-disabled']) {
                specialZoneCount++;
            }
        }
    });
    if (document.getElementById('stat-special-zones')) 
        document.getElementById('stat-special-zones').innerText = specialZoneCount.toLocaleString();

    // 5. 운영 통계 요약 (Stats Input 탭의 모든 지표를 포함하도록 업데이트)
    // 5. 운영 통계 요약 (용어 통일 및 분류 조정)
    const summaryData = {
        facilities: [
            { key: 'form_2', label: "단일로" },
            { id: 1, label: "3지 교차로" },
            { id: 2, label: "4지 교차로" },
            { id: 3, label: "5지 교차로" },
            { id: 4, label: "6지 이상" },
            { id: 21, label: "어린이 보호구역" },
            { id: 22, label: "노인 보호구역" },
            { id: 23, label: "장애인 보호구역" },
            { id: 24, label: "대각선 횡단" },
            { id: 25, label: "이단 횡단" },
            { id: 26, label: "교통섬" },
            { id: 31, label: "잔여_적색" },
            { id: 32, label: "잔여_녹색" },
            { id: 33, label: "보조등_좌" },
            { id: 34, label: "보조등_우" },
            { id: 35, label: "바닥신호" }
        ],
        operations: [
            { id: 41, label: "보호 좌회전" },
            { id: 42, label: "비보호 좌회전" },
            { id: 43, label: "PPLT" },
            { id: 44, label: "PDLT" },
            { id: 45, label: "직좌 동시신호" },
            { id: 51, label: "우회전 전용신호" },
            { id: 52, label: "우회전 도류화" },
            { id: 61, label: "보행조기" },
            { id: 62, label: "LPI" },
            { id: 63, label: "0.7m/s" },
            { id: 64, label: "보행연장" },
            { id: 65, label: "다회보행" },
            { id: 66, label: "동시보행" },
            { id: 67, label: "자동연장" },
            { id: 68, label: "보행시차" },
            { id: 12, label: "항시/전일 점멸" },
            { id: 13, label: "시간제 점멸" }
        ]
    };

    const counts = {};
    const controllerCounts = {};
    junctions.forEach(j => {
        const stats = j.opStats || [];
        
        if (j.controller) {
            const c = (j.controller || "").trim();
            if (c) controllerCounts[c] = (controllerCounts[c] || 0) + 1;
        }

        // 단일로 판정 (접근로 2개 활성화)
        const activeApproachCount = [...j.movA, ...j.movB].filter(m => m > 0).length;
        const isSingleRoad = (activeApproachCount === 2);

        [...summaryData.facilities, ...summaryData.operations].forEach(item => {
            if (!counts[item.label]) counts[item.label] = 0;
            
            if (item.key === 'form_2') {
                if (isSingleRoad) counts[item.label]++;
            } else if (item.id !== undefined && stats[item.id]) {
                counts[item.label]++;
            }
        });
    });

    const renderGroup = (title, items, color) => `
        <div style="margin-bottom:12px;">
            <div style="font-size:11px; color:${color}; font-weight:bold; margin-bottom:6px; border-bottom:2px solid ${color}33; padding-bottom:2px;">${title}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:x 15px;">
                ${items.map(item => `
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.03); padding:3px 0; align-items:center;">
                        <span style="color:#bbb; font-size:10.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.label}">${item.label}</span>
                        <span style="font-weight:bold; color:#fff; font-size:11px; margin-left:8px;">${counts[item.label] || 0}<small style="font-weight:normal; color:#666; font-size:9.5px; margin-left:2px;">개</small></span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const renderControllerSummary = (cCounts) => {
        const items = Object.entries(cCounts).sort((a, b) => b[1] - a[1]);
        if (items.length === 0) return '';
        return `
            <div style="margin-bottom:10px;">
                <div style="font-size:11px; color:#3498db; font-weight:bold; margin-bottom:6px; border-bottom:2px solid rgba(52,152,219,0.2); padding-bottom:2px;">🤖 제어기 현황 (Controllers)</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:x 15px;">
                    ${items.map(([label, count]) => `
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.03); padding:3px 0;">
                            <span style="color:#bbb; font-size:10.5px;">${label}</span>
                            <span style="font-weight:bold; color:#fff; font-size:11px;">${count}<small style="font-weight:normal; color:#666; font-size:9.5px; margin-left:2px;">개</small></span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    document.getElementById('stat-op-summary').innerHTML = `
        ${renderGroup('🏗️ 도로시설 (Road Facilities)', summaryData.facilities, '#00d4ff')}
        ${renderGroup('🚦 신호운영 (Signal Operations)', summaryData.operations, '#2ecc71')}
        ${renderControllerSummary(controllerCounts)}
    `;

    // 대시보드 동기화 (오버레이가 열려 있는 경우)
    if (typeof updateDashboardStats === 'function') {
        updateDashboardStats();
    }
}

/* ══════════════════════════════════════════
 *  Chart.js 래퍼
 * ══════════════════════════════════════════ */
function updateChart(id, type, data, axisOpts) {
    axisOpts = axisOpts || {};
    if (charts[id]) charts[id].destroy();
    const ctx = document.getElementById(id).getContext('2d');
    charts[id] = new Chart(ctx, {
        type: type,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: axisOpts.legend?.display || false,
                    labels: { color: '#ccc', font: { size: 10 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: axisOpts.yMin === 0,
                    min: axisOpts.yMin !== undefined ? axisOpts.yMin : undefined,
                    max: axisOpts.yMax !== undefined ? axisOpts.yMax : undefined,
                    grid: { color: '#222' },
                    ticks: {
                        color: '#888',
                        font: { size: 10 },
                        stepSize: axisOpts.yStep !== undefined ? axisOpts.yStep : undefined
                    }
                },
                x: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } }
            }
        }
    });
}

/* ══════════════════════════════════════════
 *  sigma_stats.csv 저장 / 불러오기
 * ══════════════════════════════════════════ */

const STATS_DIRS = ['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'];
const STATS_PLAN_TYPES = ['일반'];

/** 교차로 전역(Global) Boolean 필드: opt_junctionState 기반 */
const STATS_GLOBAL_MAP = [
    { csv: 'FlashGreen',  key: 'flash',      val: '항시녹색'  },
    { csv: 'FlashAll',    key: 'flash',      val: '항시점멸'  },
    { csv: 'FlashTimed',  key: 'flash',      val: '시간제점멸' },
    { csv: 'EmgFireSt',   key: 'emgFireSt',  val: null },
    { csv: 'EmgFireTr',   key: 'emgFireTr',  val: null },
    { csv: 'EtcOper',     key: 'etcOper',    val: null },
    { csv: 'EtcSpare1',   key: 'etcSpare1',  val: null },
];

const STATS_BOOL_MAP = [
    { csv: 'ZoneChild',     path: 'top', key: 'children'      },
    { csv: 'ZoneOld',       path: 'top', key: 'elderly'        },
    { csv: 'ZoneDis',       path: 'top', key: 'disabled'       },
    { csv: 'cwDiag',        path: 'top', key: 'diagonal'       },
    { csv: 'cwTwo',         path: 'top', key: 'twoStage'       },
    { csv: 'cwIsland',      path: 'top', key: 'trafficIsland'  },
    { csv: 'ResRed',        path: 'op',  key: 'residRed'       },
    { csv: 'ResGreen',      path: 'op',  key: 'residGreen'     },
    { csv: 'AuxLeft',       path: 'op',  key: 'auxA'           },
    { csv: 'AuxRight',      path: 'op',  key: 'auxB'           },
    { csv: 'FloorSignal',   path: 'op',  key: 'floorSig'       },
    { csv: 'leftProt',      path: 'op',  key: 'leftProt'       },
    { csv: 'leftPerm',      path: 'op',  key: 'leftUnprot'     },
    { csv: 'leftPplt',      path: 'op',  key: 'leftPplt'       },
    { csv: 'leftPdlt',      path: 'op',  key: 'leftPdlt'       },
    { csv: 'leftST',        path: 'op',  key: 'leftTurnSimul'  },
    { csv: 'Leadlag',       path: 'op',  key: 'leftLeadLag'    },
    { csv: 'UtSig',         path: 'op',  key: 'uTurnSig'       },
    { csv: 'rightSig',      path: 'op',  key: 'rightOnly'      },
    { csv: 'channelSig',    path: 'op',  key: 'rightChannel'   },
    { csv: 'PedEarly',      path: 'op',  key: 'pedEarly'       },
    { csv: 'pedLpi',        path: 'op',  key: 'pedLpi'         },
    { csv: 'pedSpd07',      path: 'op',  key: 'spd07'          },
    { csv: 'PedExtend',     path: 'op',  key: 'pedExt'         },
    { csv: 'pedMulti',      path: 'op',  key: 'pedMulti'       },
    { csv: 'PedSync',       path: 'op',  key: 'pedSimul'       },
    { csv: 'PedAutoExtend', path: 'op',  key: 'autoExt'        },
    { csv: 'pedLag',        path: 'op',  key: 'pedLagActive'   },
];

const STATS_CSV_HEADERS = [
    'ID', 'Seq', 'PlanType',
    ...STATS_GLOBAL_MAP.map(m => m.csv),
    'lane_N', 'lane_E', 'lane_S', 'lane_W', 'lane_NE', 'lane_SE', 'lane_SW', 'lane_NW',
    ...STATS_BOOL_MAP.map(m => m.csv)
];

let _statsFileName = 'sigma_stats.csv';

function _serializeLaneCell(dirState) {
    if (!dirState) return '';
    const act = dirState.active ? 1 : 0;
    const typeKeys = ['C','U','LU','L','LT','T','TR','R','R_D','CW','CW_D','SPD'];
    const aVals = typeKeys.map(k => (dirState.A ? (dirState.A[k] ?? 0) : 0)).join(',');
    const bVals = typeKeys.map(k => (dirState.B ? (dirState.B[k] ?? 0) : 0)).join(',');
    return `act:${act}|A:${aVals}|B:${bVals}`;
}

function _deserializeLaneCell(cellVal) {
    if (!cellVal) return null;
    const typeKeys = ['C','U','LU','L','LT','T','TR','R','R_D','CW','CW_D','SPD'];
    const parts = cellVal.split('|');
    const act = (parts[0] || '').split(':')[1] === '1';
    const parseBlock = prefix => {
        const part = parts.find(p => p.startsWith(prefix + ':'));
        if (!part) return {};
        const vals = part.substring(prefix.length + 1).split(',');
        return Object.fromEntries(typeKeys.map((k, i) => [k, parseFloat(vals[i]) || 0]));
    };
    return { active: act, A: parseBlock('A'), B: parseBlock('B') };
}

function _junctionsToStatsRows() {
    const rows = [];
    const junctions = (typeof STATE !== 'undefined') ? STATE.junctions : {};
    Object.values(junctions).forEach(j => {
        const optState = j.optimizerState;
        // summary(점멸/긴급) 정보: optimizerState.summary 또는 opt_junctionState 참조
        const summary = (optState && optState.summary) ? optState.summary : {};
        const flashList = summary.flash || [];

        const row = {
            ID: j.id || '',
            Seq: j.seq || '',
            PlanType: '일반'
        };

        // [전역 Boolean 필드] 점멸/긴급/기타
        STATS_GLOBAL_MAP.forEach(mapping => {
            if (mapping.val !== null) {
                // flash 배열에 val 포함 여부
                row[mapping.csv] = flashList.includes(mapping.val) ? '1' : '0';
            } else {
                row[mapping.csv] = summary[mapping.key] ? '1' : '0';
            }
        });

        // [방향별 차로 필드]
        STATS_DIRS.forEach(dir => {
            row[`lane_${dir}`] = optState ? _serializeLaneCell(optState[dir]) : '';
        });

        // [방향별 Boolean 통계 필드]
        STATS_BOOL_MAP.forEach(mapping => {
            if (!optState) { row[mapping.csv] = ''; return; }
            const active = STATS_DIRS.filter(dir => {
                const s = optState[dir];
                if (!s || !s.active) return false;
                const val = mapping.path === 'top' ? s[mapping.key] : (s.op ? s.op[mapping.key] : false);
                return !!val;
            });
            row[mapping.csv] = active.join(';');
        });

        rows.push(row);
    });
    return rows;
}

function _rowsToCsvString(rows) {
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const header = STATS_CSV_HEADERS.map(esc).join(',');
    const body = rows.map(r => STATS_CSV_HEADERS.map(h => esc(r[h] ?? '')).join(',')).join('\n');
    return header + '\n' + body;
}

function _loadStatsCsv(csvText) {
    const text = csvText.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('데이터 행이 없습니다.');
    const headers = _parseCsvLine(lines[0]);
    for (let i = 1; i < lines.length; i++) {
        const vals = _parseCsvLine(lines[i]);
        if (vals.length < 3) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
        const jid = row['ID'];
        const j = (typeof STATE !== 'undefined') ? STATE.junctions[jid] : null;
        if (!j) continue;
        if (!j.optimizerState) j.optimizerState = {};
        if (!j.optimizerState.summary) j.optimizerState.summary = {};

        // [전역 Boolean 필드] 역직렬화
        const flashList = [];
        STATS_GLOBAL_MAP.forEach(mapping => {
            const isOn = row[mapping.csv] === '1';
            if (mapping.val !== null) {
                if (isOn) flashList.push(mapping.val);
            } else {
                j.optimizerState.summary[mapping.key] = isOn;
            }
        });
        j.optimizerState.summary.flash = flashList;

        // [방향별 차로 필드] 역직렬화
        STATS_DIRS.forEach(dir => {
            const parsed = _deserializeLaneCell(row[`lane_${dir}`] || '');
            if (parsed) {
                if (!j.optimizerState[dir]) j.optimizerState[dir] = {};
                j.optimizerState[dir].active = parsed.active;
                j.optimizerState[dir].A = { ...(j.optimizerState[dir].A || {}), ...parsed.A };
                j.optimizerState[dir].B = { ...(j.optimizerState[dir].B || {}), ...parsed.B };
            }
        });

        // [방향별 Boolean 통계 필드] 역직렬화
        STATS_BOOL_MAP.forEach(mapping => {
            const activeDirs = (row[mapping.csv] || '').split(';').map(s => s.trim()).filter(Boolean);
            STATS_DIRS.forEach(dir => {
                if (!j.optimizerState[dir]) j.optimizerState[dir] = {};
                if (mapping.path === 'top') {
                    j.optimizerState[dir][mapping.key] = activeDirs.includes(dir);
                } else {
                    if (!j.optimizerState[dir].op) j.optimizerState[dir].op = {};
                    j.optimizerState[dir].op[mapping.key] = activeDirs.includes(dir);
                }
            });
        });
    }
    if (typeof loadOptStateFromJunction === 'function' && typeof STATE !== 'undefined' && STATE.activeJid) {
        loadOptStateFromJunction(STATE.junctions[STATE.activeJid]);
    }
}

function _parseCsvLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
            result.push(cur); cur = '';
        } else {
            cur += ch;
        }
    }
    result.push(cur);
    return result;
}

function generateStatsCSV() {
    const rows = _junctionsToStatsRows();
    if (rows.length === 0) return "";
    return _rowsToCsvString(rows);
}

window.generateStatsCSV = generateStatsCSV;
window.processStatsCSV = _loadStatsCsv; // 통합 DB 로더 연동용 노출

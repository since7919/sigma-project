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
        if (topScrollCon) topScrollCon.style.display = 'block';
        if (topScrollContent) topScrollContent.style.width = '1100px';
    } else {
        table.style.width = '100%';
        if (topScrollCon) topScrollCon.style.display = 'none';
    }
    table.style.tableLayout = 'fixed';

    // 스크롤 동기화 및 입력 감지 (한 번만)
    if (!container.dataset.syncInit) {
        if (topScrollCon) {
            container.onscroll = () => { topScrollCon.scrollLeft = container.scrollLeft; };
            topScrollCon.onscroll = () => { container.scrollLeft = topScrollCon.scrollLeft; };
        }

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
    
    // [신규] 심층 통계 렌더링 호출
    renderAdvancedInsights(junctions);
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
        const activeMovs = [...new Set([...(j.movA || []), ...(j.movB || [])])].filter(m => m > 0).length;
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
        const activeApproachCount = [...(j.movA || []), ...(j.movB || [])].filter(m => m > 0).length;
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

const STATS_TYPE_KEYS = ['C','U','LU','L','LT','T','TR','R','R_D','CW','CW_D','SPD'];
function _deserializeLaneCell(cellVal) {
    if (!cellVal) return null;
    const parts = cellVal.split('|');
    const act = (parts[0] || '').split(':')[1] === '1';
    const parseBlock = prefix => {
        const prefixColon = prefix + ':';
        let part = null;
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].startsWith(prefixColon)) {
                part = parts[i];
                break;
            }
        }
        if (!part) return {};
        const vals = part.substring(prefixColon.length).split(',');
        const obj = {};
        for (let i = 0; i < STATS_TYPE_KEYS.length; i++) {
            obj[STATS_TYPE_KEYS[i]] = parseFloat(vals[i]) || 0;
        }
        return obj;
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
    if (lines.length < 2) throw new Error('데이터가 부족합니다.');
    const headers = _parseCsvLine(lines[0]);
    
    // [최적화] 인덱스를 미리 계산하여 매 반복마다 row 객체를 생성하지 않도록 함
    const idIdx = headers.indexOf('ID');
    const globalIndices = STATS_GLOBAL_MAP.map(m => ({ mapping: m, idx: headers.indexOf(m.csv) }));
    const laneIndices = STATS_DIRS.map(dir => ({ dir: dir, idx: headers.indexOf('lane_' + dir) }));
    const boolIndices = STATS_BOOL_MAP.map(m => ({ mapping: m, idx: headers.indexOf(m.csv) }));

    for (let i = 1; i < lines.length; i++) {
        const vals = _parseCsvLine(lines[i]);
        if (vals.length < 3) continue;
        
        const jid = vals[idIdx];
        const j = (typeof STATE !== 'undefined') ? STATE.junctions[jid] : null;
        if (!j) continue;
        if (!j.optimizerState) j.optimizerState = {};
        if (!j.optimizerState.summary) j.optimizerState.summary = {};

        const flashList = [];
        for (let g = 0; g < globalIndices.length; g++) {
            const { mapping, idx } = globalIndices[g];
            const isOn = vals[idx] === '1';
            if (mapping.val !== null) {
                if (isOn) flashList.push(mapping.val);
            } else {
                j.optimizerState.summary[mapping.key] = isOn;
            }
        }
        j.optimizerState.summary.flash = flashList;

        for (let l = 0; l < laneIndices.length; l++) {
            const { dir, idx } = laneIndices[l];
            const cellVal = vals[idx];
            if (!cellVal) continue;
            
            const parsed = _deserializeLaneCell(cellVal);
            if (parsed) {
                if (!j.optimizerState[dir]) j.optimizerState[dir] = {};
                j.optimizerState[dir].active = parsed.active;
                if (!j.optimizerState[dir].A) j.optimizerState[dir].A = {};
                if (!j.optimizerState[dir].B) j.optimizerState[dir].B = {};
                Object.assign(j.optimizerState[dir].A, parsed.A);
                Object.assign(j.optimizerState[dir].B, parsed.B);
            }
        }

        for (let b = 0; b < boolIndices.length; b++) {
            const { mapping, idx } = boolIndices[b];
            const cellVal = vals[idx];
            if (!cellVal) continue;
            
            const activeDirs = cellVal.split(';');
            const dirMap = {};
            for (let k = 0; k < activeDirs.length; k++) {
                dirMap[activeDirs[k]] = true;
            }
            for (let d = 0; d < STATS_DIRS.length; d++) {
                const dir = STATS_DIRS[d];
                if (!j.optimizerState[dir]) j.optimizerState[dir] = {};
                const hasDir = dirMap[dir] || false;
                if (mapping.path === 'top') {
                    j.optimizerState[dir][mapping.key] = hasDir;
                } else {
                    if (!j.optimizerState[dir].op) j.optimizerState[dir].op = {};
                    j.optimizerState[dir].op[mapping.key] = hasDir;
                }
            }
        }
    }
    if (typeof loadOptStateFromJunction === 'function' && typeof STATE !== 'undefined' && STATE.activeJid) {
        loadOptStateFromJunction(STATE.junctions[STATE.activeJid]);
    }
}

function _parseCsvLine(line) {
    const result = [];
    let i = 0;
    const len = line.length;
    while (i < len) {
        while (i < len && line[i] === ' ') i++;
        if (i >= len) {
            result.push("");
            break;
        }
        if (line[i] === '"') {
            let j = i + 1;
            while (j < len) {
                if (line[j] === '"') {
                    if (j + 1 < len && line[j + 1] === '"') {
                        j += 2;
                    } else {
                        break;
                    }
                } else {
                    j++;
                }
            }
            let val = line.substring(i + 1, j).replace(/""/g, '"');
            result.push(val);
            i = j + 1;
            while (i < len && line[i] !== ',') i++;
            i++;
        } else {
            let j = line.indexOf(',', i);
            if (j === -1) {
                result.push(line.substring(i).trim());
                break;
            } else {
                result.push(line.substring(i, j).trim());
                i = j + 1;
            }
        }
    }
    if (len > 0 && line[len - 1] === ',') {
        result.push("");
    }
    return result;
}

function generateStatsCSV() {
    const rows = _junctionsToStatsRows();
    if (rows.length === 0) return "";
    return _rowsToCsvString(rows);
}

function generateSingleJunctionStatsCSV(jid) {
    const j = STATE.junctions[jid];
    if (!j) return "";
    const optState = j.optimizerState;
    const summary = (optState && optState.summary) ? optState.summary : {};
    const flashList = summary.flash || [];

    const row = {
        ID: j.id || '',
        Seq: j.seq || '',
        PlanType: '일반'
    };

    STATS_GLOBAL_MAP.forEach(mapping => {
        if (mapping.val !== null) {
            row[mapping.csv] = flashList.includes(mapping.val) ? '1' : '0';
        } else {
            row[mapping.csv] = summary[mapping.key] ? '1' : '0';
        }
    });

    STATS_DIRS.forEach(dir => {
        row[`lane_${dir}`] = optState ? _serializeLaneCell(optState[dir]) : '';
    });

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

    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const header = STATS_CSV_HEADERS.map(esc).join(',');
    const body = STATS_CSV_HEADERS.map(h => esc(row[h] ?? '')).join(',');
    return header + '\n' + body;
}

window.generateStatsCSV = generateStatsCSV;
window.generateSingleJunctionStatsCSV = generateSingleJunctionStatsCSV;
window.processStatsCSV = _loadStatsCsv; // 통합 DB 로더 연동용 노출


/* ══════════════════════════════════════════
 *  심층 통계 및 인사이트 (Advanced Insights)
 * ══════════════════════════════════════════ */
function renderAdvancedInsights(junctions) {
    const container = document.getElementById('stat-advanced-insights');
    if (!container) return;
    if (!junctions || junctions.length === 0) {
        container.innerHTML = '<div class="text-dim text-center p-20" style="grid-column: 1 / -1;">데이터가 없습니다.</div>';
        return;
    }

    let html = '';

    // --- 통계 집계 변수 ---
    const totalJunctions = junctions.length;
    
    // 심층 통계
    let totalMainSplit = 0, totalCycle = 0, mainPhaseCount = 0;
    let totalPhases = 0, maxPhases = 0, ptPhaseCount = 0, hasSignalMapCount = 0;
    let maxPedWaitTime = 0, sumPedWaitTime = 0, pedWaitJunctionCount = 0;
    let shortYellowCount = 0, longAllRedCount = 0;

    // 거시 지표
    let coordinatedJunctions = 0;
    let groupCounts = {}; // { groupId: count }
    let cycleCounts = {}; // { cycle: count }

    junctions.forEach(j => {
        const g = parseInt(j.group);
        if (g > 0) {
            coordinatedJunctions++;
            groupCounts[g] = (groupCounts[g] || 0) + 1;
        }

        if (j.dayPlans && j.dayPlans[0] && j.signalMaps && j.signalMaps[0]) {
            const dPlan = j.dayPlans[0][0];
            const sm = j.signalMaps[0];
            
            // 주기 집계 (거시 지표용)
            if (dPlan.cycle > 0) {
                cycleCounts[dPlan.cycle] = (cycleCounts[dPlan.cycle] || 0) + 1;
            }

            // 통행 우선권
            const mainMovements = sm.mainMovements || [];
            if (mainMovements.length > 0 && dPlan.cycle > 0) {
                let mSplit = 0;
                mainMovements.forEach(m => {
                    const isA = m < 8;
                    const ringIndex = isA ? m : m - 8;
                    mSplit += isA ? (dPlan.splitA[ringIndex] || 0) : (dPlan.splitB[ringIndex] || 0);
                });
                totalMainSplit += mSplit;
                totalCycle += dPlan.cycle;
                mainPhaseCount++;
            }

            // 현시 복잡도
            let activePhases = 0;
            let hasPT = false;
            for(let i=0; i<8; i++) {
                if (dPlan.splitA[i] > 0) activePhases++;
                if (dPlan.splitB[i] > 0) activePhases++;
                
                const mA = sm.movA[i], mB = sm.movB[i];
                if ([7, 8, 9, 20, 21, 22, 23].includes(mA) || [7, 8, 9, 20, 21, 22, 23].includes(mB)) {
                    hasPT = true;
                }
            }
            if (activePhases > 0) {
                hasSignalMapCount++;
                totalPhases += activePhases;
                if (activePhases > maxPhases) maxPhases = activePhases;
            }
            if (hasPT) ptPhaseCount++;

            // 보행자 대기시간
            let maxPedTime = 0;
            for(let i=0; i<8; i++) {
                if (sm.pedMovA && sm.pedMovA[i] > 0) maxPedTime = Math.max(maxPedTime, dPlan.splitA[i]);
                if (sm.pedMovB && sm.pedMovB[i] > 0) maxPedTime = Math.max(maxPedTime, dPlan.splitB[i]);
            }
            if (maxPedTime > 0 && dPlan.cycle > 0) {
                const waitTime = dPlan.cycle - maxPedTime;
                sumPedWaitTime += waitTime;
                maxPedWaitTime = Math.max(maxPedWaitTime, waitTime);
                pedWaitJunctionCount++;
            }

            // 소거 시간 이상치
            for(let i=0; i<8; i++) {
                if (dPlan.splitA[i] > 0) {
                    if (sm.yellowA && sm.yellowA[i] > 0 && sm.yellowA[i] < 3) shortYellowCount++;
                    if (sm.allredA && sm.allredA[i] > 0 && sm.allredA[i] >= 3) longAllRedCount++;
                }
                if (dPlan.splitB[i] > 0) {
                    if (sm.yellowB && sm.yellowB[i] > 0 && sm.yellowB[i] < 3) shortYellowCount++;
                    if (sm.allredB && sm.allredB[i] > 0 && sm.allredB[i] >= 3) longAllRedCount++;
                }
            }
        }
    });

    // --- 거시 지표 계산 ---
    const coordRate = totalJunctions > 0 ? ((coordinatedJunctions / totalJunctions) * 100).toFixed(1) : 0;
    const groupIds = Object.keys(groupCounts);
    const numGroups = groupIds.length;
    const avgGroupScale = numGroups > 0 ? (coordinatedJunctions / numGroups).toFixed(1) : 0;

    let baseCycle = 0, baseCycleCount = 0;
    Object.entries(cycleCounts).forEach(([c, cnt]) => {
        if (cnt > baseCycleCount) {
            baseCycle = c;
            baseCycleCount = cnt;
        }
    });
    const baseCycleRate = totalJunctions > 0 ? ((baseCycleCount / totalJunctions) * 100).toFixed(1) : 0;

    const sortedGroups = Object.values(groupCounts).sort((a,b) => b - a);
    const top5Sum = sortedGroups.slice(0, 5).reduce((a,b) => a+b, 0);
    const top5Rate = totalJunctions > 0 ? ((top5Sum / totalJunctions) * 100).toFixed(1) : 0;

    // --- 심층 지표 계산 ---
    const mainRatio = (totalCycle > 0) ? ((totalMainSplit / totalCycle) * 100).toFixed(1) : 0;
    const avgPhases = (hasSignalMapCount > 0) ? (totalPhases / hasSignalMapCount).toFixed(1) : 0;
    const ptRatio = (hasSignalMapCount > 0) ? ((ptPhaseCount / hasSignalMapCount) * 100).toFixed(1) : 0;
    const avgPedWait = (pedWaitJunctionCount > 0) ? (sumPedWaitTime / pedWaitJunctionCount).toFixed(0) : 0;
    
    // 컴포넌트 생성 유틸
    const InsightBox = (id, title, mainVal, subText, desc, icon, color) => `
        <div class="sigma-panel insight-box" onclick="showInsightDetail('${id}')" style="cursor: pointer; padding: 15px; margin: 0; background: rgba(0,0,0,0.3); border-left: 3px solid ${color}; border-radius: 4px; transition: background 0.2s;">
            <div class="flex-row gap-10 align-center mb-8">
                <span style="font-size: 20px;">${icon}</span>
                <span class="fs-12 fw-800 text-white">${title}</span>
            </div>
            <div class="flex-row gap-8 align-end mb-8">
                <span class="fw-900" style="font-size: 24px; color: ${color}; line-height: 1;">${mainVal}</span>
                <span class="fs-11 text-dim" style="line-height: 1.4;">${subText}</span>
            </div>
            <div class="fs-11 flex-row-between" style="color: #999; line-height: 1.4;">
                <span style="flex:1;">${desc}</span>
                <span style="color:${color}; font-size:10px; margin-left:10px; white-space:nowrap; text-decoration:underline;">상세보기</span>
            </div>
        </div>
    `;

    // 거시 지표 헤더
    html += `<div style="grid-column: 1 / -1; margin-top: 5px; margin-bottom: -5px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <span style="color: #3498db; font-size: 13px; font-weight: 700;">🌐 도시 거시 지표 (Metropolis Macro Index)</span>
    </div>`;

    html += InsightBox("macro_coord", "전체 망 연동화율", `${coordRate}%`, `(${coordinatedJunctions}개 교차로)`, 
        "전체 중 고립되지 않고 연동 그룹에 속한 비율. 수치가 높을수록 도시 전체가 고도로 동기화되어 소통을 극대화합니다.", "🌐", "#3498db");
    
    html += InsightBox("macro_scale", "평균 연동 규모", `${avgGroupScale}개`, `(총 ${numGroups}개 연동축)`, 
        "1개 연동 그룹당 묶여있는 교차로 수. 클수록 '거대 간선도로' 위주이며, 작을수록 블록이 잘게 쪼개진 구도심을 뜻합니다.", "📏", "#9b59b6");
    
    html += InsightBox("macro_cycle", "도시 지배 주기", `${baseCycle}초`, `(점유율 ${baseCycleRate}%)`, 
        "가장 많이 사용되는 최빈값 주기. 막대한 교통량을 한 번에 처리하기 위한 거시적 통행 스케일을 보여줍니다.", "⏱️", "#e67e22");

    html += InsightBox("macro_arterial", "상위 간선 집중도", `${top5Rate}%`, `(상위 5대 연동축 비중)`, 
        "상위 5개 거대 간선축이 전체 네트워크에서 차지하는 비중으로, 중앙집중화된 도로망 통제력을 시사합니다.", "🎯", "#e74c3c");

    // 심층 지표 헤더
    html += `<div style="grid-column: 1 / -1; margin-top: 15px; margin-bottom: -5px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <span style="color: #1abc9c; font-size: 13px; font-weight: 700;">🚥 신호운영 미시 통계 (Micro Operation Insights)</span>
    </div>`;

    html += InsightBox("micro_ratio", "주간선 vs 부간선 비율", `${mainRatio}%`, "주현시 녹색시간 비율",
        "비율이 높을수록 통과 위주의 '주간선'이며, 50%에 가까울수록 측면 간섭이 심한 '혼잡 교차로'입니다.", "🛣️", "#1abc9c");

    html += InsightBox("micro_phase", "현시 복잡도 및 비보호", `${avgPhases}현시`, `(비보호 ${ptRatio}% 적용)`,
        "운영 현시가 많을수록 대기시간이 길어집니다. 비보호 좌회전 적용률을 통해 효율화 기조를 엿볼 수 있습니다.", "🔄", "#34495e");

    html += InsightBox("micro_ped", "보행자 최대 대기시간", `평균 ${avgPedWait}초`, `(최대 ${maxPedWaitTime}초)`,
        "(주기 - 보행녹색시간). 값이 클수록 차량 통행 중심, 작을수록 보행자 친화적 운영을 의미합니다.", "🚶", "#f1c40f");

    html += InsightBox("micro_clearance", "소거시간 이상치", `${shortYellowCount + longAllRedCount}건`, `(황색부족 ${shortYellowCount}, 전적색과다 ${longAllRedCount})`,
        "긴 전적색은 교차로가 넓은 험지임을, 짧은 황색은 통과 사고 위험이 높은 지점임을 데이터로 유추합니다.", "⚠️", "#95a5a6");

    container.innerHTML = html;
}



/* ══════════════════════════════════════════
 *  지표 상세 모달 (Insight Details)
 * ══════════════════════════════════════════ */
const INSIGHT_DETAILS = {
    "macro_coord": {
        title: "🌐 전체 망 연동화율 (Network Coordination Rate)",
        def: "도시 또는 특정 지역 내 전체 신호교차로 중, 단독(고립) 제어가 아닌 연동 그룹에 속하여 인접 교차로와 신호 주기가 동기화된 교차로의 비율입니다.",
        calc: "(연동 그룹에 속한 교차로 수 / 전체 교차로 수) × 100",
        meaning: "이 수치가 높을수록 간선도로를 통과하는 차량이 연속적으로 녹색신호를 받을 확률이 높아지며, 도시 전체의 교통 흐름이 고도로 통제되고 있음을 뜻합니다."
    },
    "macro_scale": {
        title: "📏 평균 연동 규모 (Average Coordination Scale)",
        def: "구성된 1개의 연동 그룹당 평균적으로 몇 개의 교차로가 묶여 있는지를 나타냅니다.",
        calc: "연동 그룹에 속한 전체 교차로 수 / 총 연동 그룹 수",
        meaning: "수치가 클수록 하나로 길게 뻗은 '거대 간선도로'가 잘 구축된 신도시 형태이며, 수치가 작을수록 교차로 간격이 좁고 블록이 잘게 쪼개진 구도심 형태일 가능성이 높습니다."
    },
    "macro_cycle": {
        title: "⏱️ 도시 지배 주기 (Metropolis Base Cycle)",
        def: "해당 도시에서 가장 많은 교차로가 채택하여 사용 중인 신호 주기(최빈값)입니다.",
        calc: "전체 교차로의 주기(Cycle Length) 데이터를 집계하여 가장 빈도수가 높은 주기를 도출합니다.",
        meaning: "보통 140초 이상의 긴 주기는 교차로가 넓고 통행량이 많은 대도시형 간선도로망을 의미하며, 100초 이하의 짧은 주기는 보행자 친화적이거나 차량 소통량이 적은 지역임을 시사합니다."
    },
    "macro_arterial": {
        title: "🎯 상위 간선 집중도 (Arterial Concentration Index)",
        def: "도시 내 가장 규모가 큰 상위 5개의 거대 연동축(간선도로)이 전체 도로망에서 차지하는 비중입니다.",
        calc: "(가장 큰 5개 연동 그룹의 교차로 수 합 / 전체 교차로 수) × 100",
        meaning: "수치가 높을수록 특정 몇몇 핵심 간선도로에 교통량과 신호 통제력이 중앙집중화되어 있음을 나타냅니다."
    },
    "micro_ratio": {
        title: "🚕 주간선 vs 부간선 비율 (Main vs Sub Split Ratio)",
        def: "교차로의 전체 신호 주기(Cycle) 중 주현시(가장 통행량이 많은 주방향)에 할당된 녹색시간의 비율입니다.",
        calc: "(주현시 녹색시간의 합 / 전체 신호 주기) × 100",
        meaning: "이 비율이 60~70% 이상으로 유독 높다면 주방향 직진 통행량이 압도적으로 많은 통과 위주의 간선도로 교차로이며, 비율이 50%에 가까울수록 직진과 좌회전 등 측면 간섭이 심한 혼잡 교차로(예: 로터리형, 다지형)를 의미합니다."
    },
    "micro_phase": {
        title: "🔄 현시 복잡도 및 비보호 (Phase Complexity & PT Ratio)",
        def: "교차로 1주기를 구성하는 총 현시(Phase)의 평균 개수 및 그 중 비보호 좌회전이 적용된 비율입니다.",
        calc: "평균 현시: (총 현시 수 / 전체 교차로 수)\n비보호 비율: (비보호 교차로 / 전체 교차로) × 100",
        meaning: "현시 개수가 4현시, 5현시 등으로 잘게 쪼개질수록 차량의 대기시간이 비례하여 늘어납니다. 반면 비보호(PT) 좌회전을 적극 적용하면 현시수를 2~3개로 줄여 교차로 통과 효율을 극대화할 수 있습니다."
    },
    "micro_ped": {
        title: "🚶 보행자 최대 대기시간 (Max Ped Wait Time)",
        def: "보행자가 횡단보도 녹색신호를 놓쳤을 때, 다음 녹색신호가 켜질 때까지 기다려야 하는 최대 대기시간입니다.",
        calc: "교차로 주기(Cycle) - 가장 긴 보행자 녹색시간 (단순 추정치)",
        meaning: "이 대기시간이 100초를 초과하면 보행자의 무단횡단 심리가 급격히 증가합니다. 차량 통행 중심의 넒은 도로일수록 이 값이 크게 나타납니다."
    },
    "micro_clearance": {
        title: "⚠️ 소거시간 이상치 (Clearance Interval Anomaly)",
        def: "황색신호가 3초 미만이거나, 전적색(All-Red) 신호가 3초 이상으로 비정상적으로 길게 설정된 위험 구간의 건수입니다.",
        calc: "황색 < 3초 (짧은 황색), 전적색 >= 3초 (긴 전적색) 인 교차로 개수 합산",
        meaning: "짧은 황색은 운전자의 딜레마존을 악화시켜 꼬리물기나 급제동 사고를 유발하며, 지나치게 긴 전적색은 교차로 면적이 비정상적으로 넓거나 기하구조가 복잡한 침지형 교차로임을 암시합니다."
    }
};

window.showInsightDetail = function(id) {
    const data = INSIGHT_DETAILS[id];
    if (!data) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px);";
    
    const modal = document.createElement('div');
    modal.style.cssText = "background:#1e293b; border:1px solid #334155; border-radius:12px; width:450px; max-width:90%; box-shadow:0 10px 35px rgba(0,0,0,0.8); display:flex; flex-direction:column; overflow:hidden; font-family:'Pretendard', sans-serif;";
    
    modal.innerHTML = `
        <div style="background:#0f172a; padding:16px 20px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#fff; font-weight:700; font-size:16px;">${data.title}</span>
            <span id="insight-modal-close" style="color:#94a3b8; font-size:20px; cursor:pointer; line-height:1;">&times;</span>
        </div>
        <div style="padding:20px; display:flex; flex-direction:column; gap:20px;">
            <div>
                <div style="color:#cbd5e1; font-weight:600; font-size:13px; margin-bottom:6px; display:flex; align-items:center; gap:6px;"><span style="color:#38bdf8;">📌</span> 지표 정의</div>
                <div style="color:#94a3b8; font-size:13px; line-height:1.5; background:rgba(255,255,255,0.03); padding:10px; border-radius:6px;">${data.def}</div>
            </div>
            <div>
                <div style="color:#cbd5e1; font-weight:600; font-size:13px; margin-bottom:6px; display:flex; align-items:center; gap:6px;"><span style="color:#a78bfa;">🧮</span> 계산 방식</div>
                <div style="color:#94a3b8; font-size:13px; line-height:1.5; background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; font-family:monospace; color:#e2e8f0;">${data.calc}</div>
            </div>
            <div>
                <div style="color:#cbd5e1; font-weight:600; font-size:13px; margin-bottom:6px; display:flex; align-items:center; gap:6px;"><span style="color:#34d399;">💡</span> 분석적 의미 (Insight)</div>
                <div style="color:#94a3b8; font-size:13px; line-height:1.5; background:rgba(255,255,255,0.03); padding:10px; border-radius:6px;">${data.meaning}</div>
            </div>
        </div>
        <div style="padding:16px 20px; background:#0f172a; border-top:1px solid #334155; text-align:right;">
            <button id="insight-modal-btn-close" style="padding:8px 24px; background:#3b82f6; color:#fff; font-weight:600; border:none; border-radius:6px; cursor:pointer; font-size:13px; transition:background 0.2s;">확인</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeFn = () => document.body.removeChild(overlay);
    document.getElementById('insight-modal-close').onclick = closeFn;
    document.getElementById('insight-modal-btn-close').onclick = closeFn;
    overlay.onclick = (e) => { if(e.target === overlay) closeFn(); };
};

/**
 * junction_optimizer.js
 * ─────────────────────────────────────────────
 * 8지 교차로 최적화 및 상세 운영 설정 로직
 * Integrated into SIGMA Dashboard
 */

const OPT_DIRS = [
    { id: 'N', a: 90, x: 125, y: 235, label: '북' },
    { id: 'E', a: 0, x: 235, y: 125, label: '동' },
    { id: 'S', a: -90, x: 125, y: 15, label: '남' },
    { id: 'W', a: 180, x: 15, y: 125, label: '서' },
    { id: 'NE', a: 45, x: 205, y: 205, label: '북동' },
    { id: 'SE', a: -45, x: 205, y: 45, label: '동남' },
    { id: 'SW', a: 225, x: 45, y: 45, label: '서남' },
    { id: 'NW', a: 135, x: 45, y: 205, label: '서북' }
];

const OPT_TYPES = { C: '중앙차로', U: '유턴', LU: '좌_유', L: '좌회전', LT: '직_좌', T: '직진', TR: '직_우', LR: '좌_우', R: '우회전', R_D: '우_도류', CW: '횡단보도', CW_D: '횡단_도류', SPD: '제한속도' };

const OPT_SEQ = [
    { c: 'A', t: 'C', g: null }, { c: 'B', t: 'C', g: null },
    { c: 'A', t: 'U', g: 0 }, { c: 'B', t: 'U', g: 30 },
    { c: 'A', t: 'LU', g: [0, 90] }, { c: 'B', t: 'LU', g: [30, 60] },
    { c: 'B', t: 'L', g: 60 }, { c: 'A', t: 'L', g: 90 }, { c: 'A', t: 'LT', g: [180, 90] }, { c: 'B', t: 'LT', g: [180, 60] },
    { c: 'A', t: 'T', g: 180 }, { c: 'B', t: 'T', g: 210 }, { c: 'A', t: 'TR', g: [180, 270] }, { c: 'B', t: 'TR', g: [180, 300] },
    { c: 'A', t: 'R', g: 270 }, { c: 'B', t: 'R', g: 300 }
];

/** 운영 항목 요약 구성을 메타데이터화하여 확장성 확보 */
const OPT_SUMMARY_ROWS = [
    {
        label: '차로(좌/직/우)',
        fn: d => {
            const s = opt_state[d];
            const num = (v) => `<span style="${v > 0 ? 'color:#fff' : 'color:#555'}">${v}</span>`;
            const rd = (v) => v > 0 ? `<small style="color:var(--accent); margin-left:2px;">(${v})</small>` : '';
            return `${num(s.A.L + s.B.L)} / ${num(s.A.T + s.B.T)} / ${num(s.A.R + s.B.R)}${rd(s.A.R_D + s.B.R_D)}`;
        }
    },
    {
        label: '제한속도(V)',
        fn: d => `<span style="color:var(--accent); font-weight:bold;">${opt_state[d].A.SPD || 50}</span>`
    },
    {
        label: '보행대상(어/노/장)',
        fn: d => {
            const s = opt_state[d];
            const check = (val) => val ? '<span style="color:#2ecc71;">●</span>' : '<span style="color:#444;">○</span>';
            return `${check(s.children)}${check(s.elderly)}${check(s.disabled)}`;
        }
    },
    {
        label: '보행시설(대/2/섬)',
        fn: d => {
            const s = opt_state[d];
            const check = (val) => val ? '<span style="color:#2ecc71;">●</span>' : '<span style="color:#444;">○</span>';
            return `${check(s.diagonal)}${check(s.twoStage)}${check(s.trafficIsland)}`;
        }
    },
    {
        label: '보행운영(시/동/LPI)',
        fn: d => {
            const s = opt_state[d];
            const check = (val) => val ? '<span style="color:#2ecc71;">●</span>' : '<span style="color:#444;">○</span>';
            return `${check(s.op.pedLagActive)}${check(s.op.pedSimul)}${check(s.op.pedLpi)}`;
        }
    },
    {
        label: '좌회전(보/비/P/PD)',
        fn: d => {
            const s = opt_state[d];
            const check = (val) => val ? '<span style="color:#2ecc71;">●</span>' : '<span style="color:#444;">○</span>';
            return `${check(s.op.leftProt)}${check(s.op.leftUnprot)}${check(s.op.leftPplt)}${check(s.op.leftPdlt)}`;
        }
    },
    {
        label: '감응(좌/앞/보)',
        fn: d => {
            const act = opt_state[d].op.act;
            const check = (val) => val ? '<span style="color:#2ecc71;">●</span>' : '<span style="color:#444;">○</span>';
            if (!act) return `${check(false)}${check(false)}${check(false)}`;
            return `${check(act.left?.sType > 0 && act.left?.sType !== 'none')}` +
                `${check(act.grid?.sType > 0 && act.grid?.sType !== 'none')}` +
                `${check(act.ped?.sType > 0 && act.ped?.sType !== 'none')}`;
        }
    }
];

function getDefaultOptState() {
    return Object.fromEntries(OPT_DIRS.map(d => [d.id, {
        active: false,
        diagonal: false, twoStage: false, trafficIsland: false, children: false, elderly: false, disabled: false,
        A: { C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 1, TR: 0, R: 0, R_D: 0, CW: 0, CW_D: 0, SPD: 50 },
        B: { C: 0, U: 0, LU: 0, L: 0, LT: 0, T: 0, TR: 0, R: 0, R_D: 0, CW: 0, CW_D: 0, SPD: 50 },
        op: {
            leftProt: false, leftUnprot: false, leftPplt: false, leftPdlt: false,
            leftTurnSimul: false, leftLeadLag: false, uTurnSig: false,
            rightSig: false, rightAux: false, rightChannel: false, rightOnly: false,
            residRed: false, residGreen: false, auxA: false, auxB: false, floorSig: false,
            spd07: false, pedEarly: false, pedExt: false, pedMulti: false, pedLpi: false, pedSimul: false, autoExt: false,
            pedLagActive: false, pedLagSS: '', pedLagSE: '', pedLagTS: '', pedLagTE: '',
            actSkip: false, actEarly: false, actMax: false,
            act: {
                left: { sType: 0, tType: 0, memo: '', sS: '', sE: '', tS: '', tE: '' },
                grid: { sType: 0, tType: 0, memo: '', sS: '', sE: '', tS: '', tE: '' },
                ped: { sType: 0, tType: 0, spg: 0, spy: 0, spr: 0, tpg: 0, tpy: 0, tpr: 0, sS: '', sE: '', tS: '', tE: '' }
            }
        }
    }]));
}

let opt_state = getDefaultOptState();

let opt_junctionState = {
    controller: '',
    flash: [],
    emgFireSt: false, emgFireTr: false,
    etcOper: false, etcSpare1: false
};

let opt_curId = null;
let opt_selectedIds = []; // 다중 선택 관리를 위한 배열 추가
let opt_statsExpanded = false;

/**
 * 초기화: UI 생성 및 이벤트 바인딩
 */
function initOptimizer() {
    const fU = document.getElementById('lane-fields-unified');
    const nl = document.getElementById('node-layer');
    if (!fU || !nl) return;

    // 테이블 헤더 생성 (구분, 기본, 확장, 보행, 보조)
    const createHeader = () => `<div style="display:grid; grid-template-columns:55px 40px 40px 85px 85px; gap:8px; margin-bottom:8px; font-size:9px; color:#888; border-bottom:1px solid #333; padding-bottom:3px;">
        <div style="text-align:left; padding-left:5px; border-right:1px solid #333;">구분</div>
        <div style="text-align:center; border-right:1px solid #333;">기본(A)</div>
        <div style="text-align:center; border-right:1px solid #333;">확장(B)</div>
        <div style="text-align:left; padding-left:10px;">보행</div>
        <div style="text-align:left; padding-left:10px;">보조</div>
    </div>`;

    fU.innerHTML = createHeader();
    if (typeof renderTemplatePanel === 'function') renderTemplatePanel();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();

    // 속성 매핑 (행별로 보행/보조 체크박스 분산 배치)
    const propMap = [
        { ped: { k: 'children', l: '어린이' }, aux: { o: 'residRed', l: '잔여적색' } },
        { ped: { k: 'elderly', l: '노인' }, aux: { o: 'residGreen', l: '잔여녹색' } },
        { ped: { k: 'disabled', l: '장애인' }, aux: { o: 'auxA', l: '보조등좌' } },
        { ped: null, aux: { o: 'auxB', l: '보조등우' } },
        { ped: { k: 'diagonal', l: '대각선' }, aux: { o: 'floorSig', l: '바닥신호' } },
        { ped: { k: 'twoStage', l: '이단횡단' }, aux: null },
        { ped: { k: 'trafficIsland', l: '교통섬' }, aux: null }
    ];

    // 입력 필드 생성 (슬림화 적용)
    Object.entries(OPT_TYPES).forEach(([k, v], idx) => {
        const rowClass = (k === 'C') ? 'blue-label' : '';
        const rowStyle = `display:grid; grid-template-columns:55px 35px 35px 85px 85px; gap:4px; margin-bottom:1px; align-items:center;`; 

        const p = propMap[idx] || { ped: null, aux: null };
        const pedHtml = p.ped ? `<label style="font-size:10px; color:#888; cursor:pointer; display:flex; align-items:center; gap:2px;"><input type="checkbox" data-key="${p.ped.k}" style="width:11px; height:11px;">${p.ped.l}</label>` : '';
        const auxHtml = p.aux ? `<label style="font-size:10px; color:#888; cursor:pointer; display:flex; align-items:center; gap:2px;"><input type="checkbox" data-op="${p.aux.o}" style="width:11px; height:11px;">${p.aux.l}</label>` : '';

        fU.innerHTML += `<div class="input-row-opt ${rowClass}" style="${rowStyle}">
            <label style="color:#aaa; font-size:10.5px; white-space:nowrap; border-right:1px solid #333; height:100%; display:flex; align-items:center;">${v}</label>
            <div style="border-right:1px solid #333; height:100%; display:flex; align-items:center; justify-content:center;">
                <input type="number" data-col="A" data-type="${k}" style="background:#000; color:#fff; border:1px solid #444; border-radius:4px; text-align:center; font-size:11px; height:17px; width:28px;">
            </div>
            <div style="border-right:1px solid #333; height:100%; display:flex; align-items:center; justify-content:center;">
                <input type="number" data-col="B" data-type="${k}" style="background:#000; color:#fff; border:1px solid #444; border-radius:4px; text-align:center; font-size:11px; height:17px; width:28px;">
            </div>
            <div style="display:flex; align-items:center; height:100%; padding-left:4px;">${pedHtml}</div>
            <div style="display:flex; align-items:center; height:100%; padding-left:4px;">${auxHtml}</div>
        </div>`;
    });

    // SVG 노드 생성
    nl.innerHTML = '';
    OPT_DIRS.forEach(d => {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        Object.entries({ cx: d.x, cy: d.y, r: 5, class: 'node' }).forEach(([k, v]) => c.setAttribute(k, v));
        c.onclick = () => selectOptDir(d.id);
        c.ondblclick = () => toggleOptActive(d.id);
        nl.appendChild(c);
    });

    // 이벤트 리스너: 입력 변경 시 자동 저장 및 렌더링
    const optControls = document.getElementById('opt-controls');
    if (optControls) {
        optControls.oninput = e => handleOptInput(e);
    }

    const jStatsTable = document.getElementById('j-stats-table');
    if (jStatsTable) {
        jStatsTable.oninput = e => handleJStatsInput(e);
    }

    renderOptimizer();
}

/**
 * 입력 핸들러: UI 변경사항을 opt_state에 반영
 */
function handleOptInput(e) {
    const t = e.target;
    if (opt_selectedIds.length === 0) return;

    // 선택된 모든 ID에 대해 동일한 작업 수행
    opt_selectedIds.forEach(id => {
        const s = opt_state[id];
        if (!s) return;

        if (t.dataset.key) {
            s[t.dataset.key] = t.checked;
            // 어린이, 노인, 장애인 체크 시 제한속도 30으로 자동 변경
            if (['children', 'elderly', 'disabled'].includes(t.dataset.key) && t.checked) {
                s.A.SPD = 30;
                const spdInp = document.querySelector('input[data-col="A"][data-type="SPD"]');
                if (spdInp) spdInp.value = 30;
            }
        }
        else if (t.dataset.op) {
            s.op[t.dataset.op] = t.checked;
            if (t.checked) {
                if (t.dataset.op === 'rightOnly' && (s.A.R || 0) === 0) {
                    s.A.R = 1;
                    const rInp = document.querySelector('input[data-col="A"][data-type="R"]');
                    if (rInp) rInp.value = 1;
                }
                if (t.dataset.op === 'rightChannel') {
                    if ((s.A.CW_D || 0) === 0) {
                        s.A.CW_D = 4;
                        const cwDInp = document.querySelector('input[data-col="A"][data-type="CW_D"]');
                        if (cwDInp) cwDInp.value = 4;
                    }
                    if ((s.A.R_D || 0) === 0) {
                        s.A.R_D = 1;
                        const rdInp = document.querySelector('input[data-col="A"][data-type="R_D"]');
                        if (rdInp) rdInp.value = 1;
                    }
                }
            } else {
                if (t.dataset.op === 'rightOnly') {
                    s.A.R = 0;
                    const rInp = document.querySelector('input[data-col="A"][data-type="R"]');
                    if (rInp) rInp.value = 0;
                }
                if (t.dataset.op === 'rightChannel') {
                    s.A.CW_D = 0; s.A.R_D = 0;
                    const cwDInp = document.querySelector('input[data-col="A"][data-type="CW_D"]');
                    if (cwDInp) cwDInp.value = 0;
                    const rdInp = document.querySelector('input[data-col="A"][data-type="R_D"]');
                    if (rdInp) rdInp.value = 0;
                }
            }
        }
        else if (t.dataset.opField) s.op[t.dataset.opField] = t.value;
        else if (t.dataset.act) {
            const key = t.dataset.act, period = t.dataset.period, field = t.dataset.field;
            if (t.type === 'radio') {
                const options = (typeof OP_MASTER_KEYS !== 'undefined') ? (OP_MASTER_KEYS.RADIO_MAPS[`actType_${key}`] || []) : [];
                const idx = options.indexOf(t.value);
                s.op.act[key][period + 'Type'] = (idx !== -1 ? idx : 0);
            }
            else if (field) {
                const storeKey = period ? period + field : field;
                s.op.act[key][storeKey] = (t.type === 'number' ? parseInt(t.value) || 0 : t.value);
            }
        }
        else if (t.dataset.col) s[t.dataset.col][t.dataset.type] = parseInt(t.value) || 0;

        // Sync legacy crosswalk bits
        s.op.cwChild = s.children; s.op.cwOld = s.elderly; s.op.cwDis = s.disabled;
        s.op.cwDiag = s.diagonal; s.op.cwTwo = s.twoStage;
    });

    // 라디오 버튼 그룹 등 UI 동기화는 마지막 선택 항목 기준으로 처리하거나 재호출
    if (t.dataset.act) syncOptActUI(t.dataset.act);

    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    saveOptToActiveJunction();
}



/**
 * 통계 요약표(제어기, 점멸, 긴급 등) 입력 핸들러
 */
function handleJStatsInput(e) {
    saveOptToActiveJunction();
}

/**
 * 방향 선택
 */
function selectOptDir(id, isShift = false) {
    if (isShift) {
        if (opt_selectedIds.includes(id)) {
            // 이미 선택된 경우 제거 (토글)
            opt_selectedIds = opt_selectedIds.filter(x => x !== id);
        } else {
            opt_selectedIds.push(id);
        }
    } else {
        opt_selectedIds = [id];
    }

    // opt_curId는 마지막 선택된 항목 또는 목록의 마지막 항목으로 유지
    opt_curId = id;

    const banner = document.getElementById('target-name');
    if (banner) {
        if (opt_selectedIds.length > 1) {
            banner.innerText = `다중 선택: ${opt_selectedIds.join(', ')}`;
        } else if (opt_selectedIds.length === 1) {
            const sid = opt_selectedIds[0];
            banner.innerText = `방향: ${sid} ${opt_state[sid].active ? '(활성)' : '(비활성)'}`;
        } else {
            banner.innerText = `방향을 선택하세요`;
        }
    }

    const controls = document.getElementById('opt-controls');
    if (controls) controls.style.display = (opt_selectedIds.length > 0) ? 'block' : 'none';

    // UI 동기화 (마지막 또는 현재 선택된 id 기준)
    const s = opt_state[id];
    if (s && opt_selectedIds.includes(id)) {
        ['diagonal', 'twoStage', 'trafficIsland', 'children', 'elderly', 'disabled'].forEach(k => {
            const input = document.querySelector(`[data-key="${k}"]`);
            if (input) input.checked = !!s[k];
        });

        document.querySelectorAll('[data-op]').forEach(i => i.checked = !!s.op[i.dataset.op]);

        Object.keys(s.op.act).forEach(key => {
            const a = s.op.act[key];
            const options = (typeof OP_MASTER_KEYS !== 'undefined') ? (OP_MASTER_KEYS.RADIO_MAPS[`actType_${key}`] || []) : [];

            ['s', 't'].forEach(p => {
                const val = a[p + 'Type'];
                const radios = document.querySelectorAll(`input[name="act_${key}_${p}"]`);
                radios.forEach(r => {
                    const rIdx = options.indexOf(r.value);
                    r.checked = (rIdx === val || r.value === val);
                });
            });

            document.querySelectorAll(`input[data-act="${key}"][data-field]`).forEach(i => {
                const p = i.dataset.period, f = i.dataset.field;
                const storeKey = p ? p + f : f;
                i.value = a[storeKey] || (i.type === 'number' ? 0 : '');
            });
            syncOptActUI(key);
        });

        document.querySelectorAll('#lane-fields-unified input[type="number"]').forEach(i => {
            if (i.dataset.col) i.value = s[i.dataset.col][i.dataset.type];
        });
    }

    renderOptimizer();
}

/**
 * 감응 UI 보이기/숨기기
 */
function syncOptActUI(key) {
    const s = opt_state[opt_curId];
    if (!s) return;
    const a = s.op.act[key];
    const options = (typeof OP_MASTER_KEYS !== 'undefined') ? (OP_MASTER_KEYS.RADIO_MAPS[`actType_${key}`] || []) : [];

    let isEtc = false;
    if (key === 'left' || key === 'grid') {
        const sVal = a.sType, tVal = a.tType;
        // 인덱스 3 또는 문자열 '기타' 확인
        isEtc = (sVal === 3 || sVal === '기타' || tVal === 3 || tVal === '기타');
    }
    const memo = document.getElementById(`act-${key}-memo`);
    if (memo) memo.style.display = isEtc ? 'block' : 'none';
}

/**
 * 방향 활성/비활성 토글
 */
function toggleOptActive(id) {
    opt_state[id].active = !opt_state[id].active;
    if (opt_curId === id) {
        document.getElementById('target-name').innerText = `방향: ${id} ${opt_state[id].active ? '(활성)' : '(비활성)'}`;
    }
    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    saveOptToActiveJunction();
}

/**
 * 통계 확장 토글
 */
function toggleStatsExpand() {
    opt_statsExpanded = !opt_statsExpanded;
    const btn = document.getElementById('btn-expand-stats');
    if (btn) btn.innerText = opt_statsExpanded ? "➖ 방향 축소 (4지)" : "➕ 방향 확장 (8지)";
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
}

function renderOptimizerStats() {
    const mainDirs = ['N', 'E', 'S', 'W'];
    const targetDirs = opt_statsExpanded ? OPT_DIRS : OPT_DIRS.filter(d => mainDirs.includes(d.id));

    // op-stats-container 렌더링 (메타데이터 활용)
    const opStatsRows = OPT_SUMMARY_ROWS.map(r => ({
        cells: [
            { content: r.label, style: 'padding:4px; background:rgba(0,0,0,0.3); color:#888; border:1px solid #444; font-size:9px;' },
            ...targetDirs.map(d => ({
                content: r.fn(d.id),
                style: `border:1px solid #444; background:${opt_state[d.id].active ? 'transparent' : 'rgba(0,0,0,0.3)'}`
            }))
        ]
    }));

    SigmaUI.renderTable('op-stats-container', {
        tableId: 'op-stats-table',
        className: 'sigma-table',
        style: 'width: 100%; border-collapse: collapse; font-size: 10.5px; text-align: center;',
        head: [
            { label: '운영항목', style: 'width:80px; padding:5px; border:1px solid #444;' },
            ...targetDirs.map(d => ({
                label: d.label,
                style: `padding:5px; border:1px solid #444; color:${opt_state[d.id].active ? '#fff' : '#555'}`
            }))
        ],
        rows: opStatsRows
    });

    // j-stats-container 렌더링
    const activeCount = OPT_DIRS.filter(d => opt_state[d.id].active).length;
    const accessMap = { 2: '단일로', 3: '3지', 4: '4지', 5: '5지' };
    const activeDirs = OPT_DIRS.filter(d => opt_state[d.id].active).map(d => d.id);

    const getActiveSafety = () => {
        const m = { children: '어린이', elderly: '노인', disabled: '장애인' };
        return Object.keys(m).filter(k => activeDirs.some(id => opt_state[id][k])).map(k => m[k]).join(', ') || '-';
    };

    const getActivePedSig = () => {
        const list = [];
        if (activeDirs.some(id => opt_state[id].diagonal)) list.push('대각선');
        const opMap = {
            pedEarly: '보행전', spd07: '0.7m/s', pedMulti: '다회보행', autoExt: '자동연장',
            pedLpi: 'LPI', pedExt: '보행연장', pedSimul: '동시보행', pedLagActive: '보행시차'
        };
        Object.entries(opMap).forEach(([k, l]) => {
            if (activeDirs.some(id => opt_state[id].op[k])) list.push(l);
        });
        return list.join(', ') || '-';
    };

    const getActiveLeftRight = (type) => {
        const list = [];
        const map = type === 'left' ? { leftProt: '보호', leftUnprot: '비보호', leftPplt: 'PPLT', leftPdlt: 'PDLT', leftTurnSimul: '동시', leftLeadLag: '선/후', uTurnSig: '유턴' }
            : { rightOnly: '우회전전용', rightChannel: '도류로신호' };
        Object.entries(map).forEach(([k, l]) => {
            if (activeDirs.some(id => opt_state[id].op[k])) list.push(l);
        });
        return list.join(', ') || '-';
    };

    const getActiveAct = () => {
        const list = [];
        const map = { left: '좌회전', grid: '앞막힘', ped: '보행자' };
        Object.entries(map).forEach(([k, l]) => {
            if (activeDirs.some(id => opt_state[id].op.act[k].sType > 0 && opt_state[id].op.act[k].sType !== 'none')) list.push(l);
        });
        return list.join(', ') || '-';
    };

    const flashItems = ['항시녹색', '항시점멸', '시간제점멸'].map(val => {
        const isChecked = (opt_junctionState.flash || []).includes(val);
        return `<label style="font-size:10px;"><input type="checkbox" data-j="flash" value="${val}" ${isChecked ? 'checked' : ''}> ${val}</label>`;
    }).join('');

    const emgItems = [
        { k: 'emgFireSt', l: '소방서' }, { k: 'emgFireTr', l: '소방차' },
        { k: 'etcOper', l: '운영자' }, { k: 'etcSpare1', l: '예비1' }
    ].map(item => {
        const isChecked = !!opt_junctionState[item.k];
        return `<label style="font-size:10px;"><input type="checkbox" data-j="${item.k}" ${isChecked ? 'checked' : ''}> ${item.l}</label>`;
    }).join('');

    const jStatsRows = [
        { cells: [{ content: '제어기', style: 'color:#999; width:70px;' }, { content: opt_junctionState.controller || '-', style: 'color:#fff; font-weight:bold;' }] },
        { cells: [{ content: '접근로', style: 'color:#999;' }, { content: activeCount >= 6 ? `${activeCount}지` : (accessMap[activeCount] || (activeCount === 1 ? '단일' : '-')), style: 'color:var(--accent); font-weight:bold;' }] },
        { cells: [{ content: '보호구역', style: 'color:#999;' }, { content: getActiveSafety(), style: 'color:#f1c40f;' }] },
        { cells: [{ content: '보행신호', style: 'color:#999;' }, { content: getActivePedSig(), style: 'color:#2ecc71;' }] },
        { cells: [{ content: '좌회전신호', style: 'color:#999;' }, { content: getActiveLeftRight('left'), style: 'color:var(--accent);' }] },
        { cells: [{ content: '우회전신호', style: 'color:#999;' }, { content: getActiveLeftRight('right'), style: 'color:#e67e22;' }] },
        { cells: [{ content: '감응신호', style: 'color:#999;' }, { content: getActiveAct(), style: 'color:#3498db;' }] },
        { cells: [{ content: '점멸신호', style: 'color:#999; vertical-align:top;' }, { content: `<div class="j-input-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:2px;">${flashItems}</div>` }] },
        { cells: [{ content: '긴급/기타', style: 'color:#999; vertical-align:top;' }, { content: `<div class="j-input-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:2px;">${emgItems}</div>` }] }
    ];

    SigmaUI.renderTable('j-stats-container', {
        className: 'j-table',
        rows: jStatsRows
    });
}

/**
 * [GUI 개선] SVG 클릭 시 값 업데이트 함수
 */
function updateOptValue(dirId, col, type, delta) {
    const s = opt_state[dirId];
    if (!s) return;
    
    // 값 변경
    const curVal = s[col][type] || 0;
    const newVal = Math.max(0, curVal + delta);
    s[col][type] = newVal;
    
    // 만약 값이 0초과가 되면 해당 방향 자동 활성화
    if (newVal > 0) s.active = true;

    // UI 동기화 및 저장
    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    saveOptToActiveJunction();
    
    // 사이드바 입력 필드 동기화 (보이는 경우)
    const inp = document.querySelector(`input[data-col="${col}"][data-type="${type}"]`);
    if (inp) inp.value = newVal;
}

/**
 * 시각화 렌더링 (SVG)
 */
function renderOptimizer() {
    const rl = document.getElementById('road-layer');
    const cl = document.getElementById('cw-layer');
    const nl = document.getElementById('node-layer');
    if (!rl || !cl || !nl) return;

    rl.innerHTML = ''; cl.innerHTML = ''; nl.innerHTML = '';

    // 접근로 노드(선택 원) 복구 및 렌더링
    OPT_DIRS.forEach(d => {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const isSelected = opt_selectedIds.includes(d.id);
        Object.entries({
            cx: d.x, cy: d.y, r: 7,
            class: 'node' + (isSelected ? ' selected' : '')
        }).forEach(([k, v]) => c.setAttribute(k, v));

        c.onclick = (e) => selectOptDir(d.id, e.shiftKey);
        c.ondblclick = () => toggleOptActive(d.id);
        nl.appendChild(c);
    });

    let activeNodes = 0;

    OPT_DIRS.forEach(d => {
        const s = opt_state[d.id];
        const isSelected = opt_selectedIds.includes(d.id);
        
        // [수정] 비활성(active:false) 상태면 렌더링 제외 (선택 여부와 관계없이 도로 삭제)
        if (!s.active) return;
        activeNodes++;


        const gRoad = document.createElementNS("http://www.w3.org/2000/svg", "g");
        gRoad.setAttribute("transform", `translate(125,125) rotate(${d.a})`);
        const gCW = document.createElementNS("http://www.w3.org/2000/svg", "g");
        gCW.setAttribute("transform", `translate(125,125) rotate(${d.a})`);

        const isDiag = ['NE', 'SE', 'SW', 'NW'].includes(d.id);
        const isSafety = s.children || s.elderly || s.disabled;

        let laneIdxTotal = 0;
        let centralRows = 0;

        // [GUI 개선] 클릭 핸들러 추가
        const addInteraction = (el, type, col) => {
            el.style.cursor = 'pointer';
            el.onmousedown = (e) => {
                e.preventDefault();
                const delta = (e.button === 2) ? -1 : 1; // 우클릭:-1, 좌클릭:+1
                updateOptValue(d.id, col, type, delta);
            };
            el.oncontextmenu = (e) => e.preventDefault();
        };

        // 렌더링할 차로 시퀀스 결정 (현재 설정된 것 + 선택된 경우 고유 타입들)
        const activeTypes = OPT_SEQ.filter(m => s[m.c][m.t] > 0);
        const sequenceToRender = [...activeTypes];

        // 선택된 방향인 경우, 주요 타입(L, T, R, CW)이 없으면 고스트 차로로 추가
        if (isSelected) {
            ['L', 'T', 'R'].forEach(t => {
                if (!activeTypes.some(m => m.t === t)) {
                    sequenceToRender.push({ c: 'A', t: t, isGhost: true });
                }
            });
            if (s.A.CW === 0 && s.B.CW === 0) {
                sequenceToRender.push({ c: 'A', t: 'CW', isGhost: true });
            }
        }

        sequenceToRender.forEach(m => {
            const count = s[m.c][m.t];
            const isGhost = m.isGhost && count === 0;
            const y = -(++laneIdxTotal * 8);
            if (m.t === 'C') centralRows++;

            const grp = document.createElementNS("http://www.w3.org/2000/svg", "g");
            if (m.c === 'B') grp.classList.add('b-opacity');
            if (isGhost) {
                grp.style.opacity = '0.12'; // 투명도 약간 상향 (0.05 -> 0.12)
                grp.classList.add('ghost-grp');
            }

            // 차로 배경 (x:22 ~ 107)
            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            Object.entries({ x: 22, y: y, width: 85, height: 8, class: 'lane-rect' }).forEach(([k, v]) => r.setAttribute(k, v));
            if (isGhost) r.setAttribute("stroke-dasharray", "1,1"); // 고스트 영역 점선 표시로 가독성 확보
            addInteraction(r, m.t, m.c);
            grp.appendChild(r);

            const cwX = 22 + (85 * 0.2);    // 39
            const arrowX = 22 + (85 * 0.4); // 56
            const numX = 22 + (85 * 0.6);   // 73

            // 1. 횡단보도 기호표시
            if (m.t === 'CW' || m.t === 'CW_D' || s.trafficIsland) {
                const cwX_final = (s.twoStage && (laneIdxTotal % 2 === 0)) ? cwX - 12 : cwX;
                const cw = document.createElementNS("http://www.w3.org/2000/svg", "text");
                Object.entries({
                    x: cwX_final, y: y + 4,
                    class: `cw-pipe ${isSafety ? 'safety' : ''}`,
                    'font-size': '10px',
                    'text-anchor': 'middle',
                    'dominant-baseline': 'middle',
                    transform: `rotate(90, ${cwX_final}, ${y + 4})`
                }).forEach(([k, v]) => cw.setAttribute(k, v));

                const isEven = laneIdxTotal % 2 === 0;
                if (s.trafficIsland && isEven) {
                    cw.textContent = "⊠";
                } else {
                    cw.textContent = "≡";
                }
                addInteraction(cw, m.t, m.c);
                grp.appendChild(cw);
            }

            // 2. 화살표 표시
            const charMap = { T: "↑", L: "↰", R: "↱", U: "↶", LU: ["↰", "↶"], LT: ["↑", "↰"], TR: ["↱", "↑"], LR: ["↰", "↱"], CW: "🚶", SPD: "V" };
            if (m.t !== 'C' && m.t !== 'CW_D') {
                const symbols = Array.isArray(charMap[m.t]) ? charMap[m.t] : [charMap[m.t] || "↑"];
                const isShared = symbols.length > 1;

                symbols.forEach((char, idx) => {
                    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    const sy = isShared ? (y + 2.2 + idx * 3.6) : (y + 4);
                    const sSize = isShared ? '6px' : '9px';
                    const sRot = (m.t === 'CW' || m.t === 'SPD') ? 0 : -90;

                    Object.entries({
                        x: arrowX, y: sy,
                        class: `symbol ${isSafety ? 'safety' : ''}`,
                        'font-size': sSize,
                        'dominant-baseline': 'middle',
                        'text-anchor': 'middle',
                        transform: `rotate(${sRot}, ${arrowX}, ${sy})`
                    }).forEach(([k, v]) => txt.setAttribute(k, v));
                    txt.textContent = char;
                    addInteraction(txt, m.t, m.c);
                    grp.appendChild(txt);
                });
            }

            // 3. 차로수 숫자 표시
            const num = document.createElementNS("http://www.w3.org/2000/svg", "text");
            const textRot = -d.a;
            Object.entries({
                x: numX, y: y + 4,
                fill: (m.t === 'C' ? '#3498db' : (isSafety ? '#f1c40f' : '#ffffff')),
                'font-size': '10px',
                'font-weight': 'bold',
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                transform: `rotate(${textRot}, ${numX}, ${y + 4})`
            }).forEach(([k, v]) => num.setAttribute(k, v));
            num.textContent = isGhost ? "+" : (m.t === 'C' ? `C${count}` : count);
            addInteraction(num, m.t, m.c);
            grp.appendChild(num);

            gRoad.appendChild(grp);
        });

        // 차선 렌더링
        for (let i = 0; i <= laneIdxTotal; i++) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            let lc = 'lane-divider';
            if (i === 0) {
                lc = (centralRows > 0 ? 'center-line blue' : 'center-line');
            } else if (i === laneIdxTotal) {
                lc = 'road-border';
            } else if (i <= centralRows) {
                lc = 'lane-divider blue';
            }

            const isGhostLine = (i > 0 && i <= laneIdxTotal) && 
                               sequenceToRender[i-1] && sequenceToRender[i-1].isGhost;
            
            Object.entries({ x1: 22, y1: -i * 8, x2: 107, y2: -i * 8, class: lc }).forEach(([k, v]) => line.setAttribute(k, v));
            if (isGhostLine) line.style.opacity = '0.07'; // 차선 투명도 강화 (0.1 -> 0.07)
            gRoad.appendChild(line);
        }

        // 우회전 도류로 시각화
        const rdCount = (s.A.R_D || 0) + (s.B.R_D || 0);
        if (rdCount > 0 || s.op.rightChannel || s.A.CW_D > 0 || s.B.CW_D > 0) {
            const gSlip = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const lastY = -(laneIdxTotal * 8);
            const slipX1 = 100, slipY1 = lastY + 4;
            const slipX2 = 35, slipY2 = lastY - 45;

            const slipLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            Object.entries({ x1: slipX1, y1: slipY1, x2: slipX2, y2: slipY2, class: 'lane-divider' }).forEach(([k, v]) => slipLine.setAttribute(k, v));
            gSlip.appendChild(slipLine);

            if ((s.A.CW_D || 0) + (s.B.CW_D || 0) > 0) {
                const ratio = 0.40, cwX = slipX1 + (slipX2 - slipX1) * ratio, cwY = slipY1 + (slipY2 - slipY1) * ratio;
                const cwD = document.createElementNS("http://www.w3.org/2000/svg", "text");
                Object.entries({ x: cwX, y: cwY + 3, class: `cw-pipe ${isSafety ? 'safety' : ''}`, 'text-anchor': 'middle', transform: `rotate(120, ${cwX}, ${cwY})` }).forEach(([k, v]) => cwD.setAttribute(k, v));
                cwD.textContent = "≡";
                addInteraction(cwD, 'CW_D', 'A');
                gSlip.appendChild(cwD);
            }

            if (rdCount > 0) {
                const ratio = 0.60, numX = slipX1 + (slipX2 - slipX1) * ratio, numY = slipY1 + (slipY2 - slipY1) * ratio;
                const rdNum = document.createElementNS("http://www.w3.org/2000/svg", "text");
                Object.entries({ x: numX, y: numY + 4, fill: isSafety ? '#f1c40f' : '#ffffff', 'font-size': '10px', 'font-weight': 'bold', 'text-anchor': 'middle', transform: `rotate(${-d.a}, ${numX}, ${numY + 4})` }).forEach(([k, v]) => rdNum.setAttribute(k, v));
                rdNum.textContent = rdCount;
                addInteraction(rdNum, 'R_D', 'A');
                gSlip.appendChild(rdNum);
            }
            gRoad.appendChild(gSlip);
        }

        rl.appendChild(gRoad); cl.appendChild(gCW);
    });

    // 중앙 노드 & 라벨 처리
    const lbl = document.getElementById('junction-label');

    if (lbl) {
        // 중앙 노드 원형 배경
        let centralNode = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        centralNode.id = 'junction-central-node';
        centralNode.setAttribute("cx", "125");
        centralNode.setAttribute("cy", "125");
        centralNode.setAttribute("r", "22");
        centralNode.setAttribute("fill", "#2d3436");
        centralNode.setAttribute("stroke", "#444");
        nl.appendChild(centralNode);

        // 대각선 횡단보도 (노드 위에 표시)
        if (activeNodes > 0 && OPT_DIRS.some(d => opt_state[d.id].active && opt_state[d.id].diagonal)) {
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
            const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
            Object.entries({ x1: 110, y1: 110, x2: 140, y2: 140, class: 'diag-cw' }).forEach(([k, v]) => l1.setAttribute(k, v));
            Object.entries({ x1: 140, y1: 110, x2: 110, y2: 140, class: 'diag-cw' }).forEach(([k, v]) => l2.setAttribute(k, v));
            g.appendChild(l1); g.appendChild(l2);
            nl.appendChild(g);
        }

        // 4지/단일 텍스트를 가장 상단으로
        lbl.textContent = activeNodes === 2 ? "단일" : (activeNodes >= 3 ? `${activeNodes}지` : "-");
        lbl.parentNode.appendChild(lbl); // DOM 순서상 가장 뒤로(위로) 보냄
    }

    // 현시 정보 테이블 연동 (main app의 phaseState와는 별개로 Optimizer 전용일 수도 있으나, 여기서는 dashboard의 active j 데이터 활용 유도)
    renderOptimizerPhaseTable();
}

function renderOptimizerPhaseTable() {
    const container = document.getElementById('opt-mov-combined-container');
    if (!container) return;

    // dashboard의 STATE.activeJid 참조
    const jid = typeof STATE !== 'undefined' ? STATE.activeJid : null;
    const j = jid ? STATE.junctions[jid] : {
        movA: [0, 0, 0, 0, 0, 0, 0, 0],
        movB: [0, 0, 0, 0, 0, 0, 0, 0]
    };

    const rows = [
        { label: 'Ring_A (Mov)', data: j.movA || [0, 0, 0, 0, 0, 0, 0, 0], type: 'val' },
        { label: 'Ring_A (Dir)', data: j.movA || [0, 0, 0, 0, 0, 0, 0, 0], type: 'arrow' },
        { label: 'Ring_B (Mov)', data: j.movB || [0, 0, 0, 0, 0, 0, 0, 0], type: 'val' },
        { label: 'Ring_B (Dir)', data: j.movB || [0, 0, 0, 0, 0, 0, 0, 0], type: 'arrow' }
    ];

    const optRows = rows.map(r => ({
        cells: [
            { content: r.label, className: 'row-label', style: 'background:rgba(255,255,255,0.05); color:#888; border:1px solid #333; padding:4px;' },
            ...r.data.map(v => {
                if (r.type === 'arrow') {
                    const a = typeof getVisualArrow === 'function' ? getVisualArrow(v) : { type: '•', ang: 0 };
                    return {
                        content: `<div style="transform:rotate(${a.ang}deg)">${a.type}</div>`,
                        style: 'color:#f1c40f; font-size:14px; text-shadow:0 0 5px rgba(0,0,0,0.5); border:1px solid #333; text-align:center;'
                    };
                }
                return {
                    content: v,
                    className: 'phase-val',
                    style: 'border:1px solid #333; text-align:center; color:#fff;'
                };
            })
        ]
    }));

    SigmaUI.renderTable('opt-mov-combined-container', {
        className: 'opt-mov-combined-table',
        style: 'width:100%; border-collapse:collapse; font-size:11px; color:#ddd; background:rgba(0,0,0,0.4);',
        rows: optRows
    });
}

/**
 * Active Junction 데이터에서 Optimizer State 로드
 */
function loadOptStateFromJunction(j) {
    const defaults = getDefaultOptState();
    if (j && j.optimizerState && Object.keys(j.optimizerState).length > 0) {
        const saved = JSON.parse(JSON.stringify(j.optimizerState));
        OPT_DIRS.forEach(d => {
            if (saved[d.id]) {
                const s = saved[d.id];
                // 1단계 머지
                opt_state[d.id] = { ...defaults[d.id], ...s };
                // 2단계 딥 머지 (객체 타입 필드)
                opt_state[d.id].A = { ...defaults[d.id].A, ...(s.A || {}) };
                opt_state[d.id].B = { ...defaults[d.id].B, ...(s.B || {}) };
                opt_state[d.id].op = { ...defaults[d.id].op, ...(s.op || {}) };

                // 감응 설정 딥 머지
                if (s.op && s.op.act) {
                    opt_state[d.id].op.act = {
                        left: { ...defaults[d.id].op.act.left, ...(s.op.act.left || {}) },
                        grid: { ...defaults[d.id].op.act.grid, ...(s.op.act.grid || {}) },
                        ped: { ...defaults[d.id].op.act.ped, ...(s.op.act.ped || {}) }
                    };
                }
            }
        });

        // 요약 정보 로드
        if (j.optimizerState.summary) {
            opt_junctionState = { ...opt_junctionState, ...j.optimizerState.summary };
        }
        // 제어기 정보는 교차로 기본 정보와 동기화
        opt_junctionState.controller = j.controller || '';
    } else {
        opt_state = defaults;
        opt_junctionState = { flash: [], emgFireSt: false, emgFireTr: false, etcOper: false, etcSpare1: false, controller: '' };
    }

    // 제어기 정보는 교차로 기본 정보와 동기화
    opt_junctionState.controller = j ? (j.controller || '') : '';

    document.querySelectorAll('input[data-j="flash"]').forEach(c => {
        c.checked = (opt_junctionState.flash || []).includes(c.value);
    });
    ['emgFireSt', 'emgFireTr', 'etcOper', 'etcSpare1'].forEach(k => {
        const c = document.querySelector(`input[data-j="${k}"]`);
        if (c) c.checked = !!opt_junctionState[k];
    });

    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();

    const firstActive = OPT_DIRS.find(d => opt_state[d.id].active);
    if (firstActive) selectOptDir(firstActive.id);
    else selectOptDir('N');
}

/**
 * Optimizer State를 Active Junction 데이터에 저장
 */
function saveOptToActiveJunction() {
    const jid = typeof STATE !== 'undefined' ? STATE.activeJid : null;
    if (!jid || !STATE.junctions[jid]) return;

    // Junction Summary UI -> opt_junctionState
    const j = STATE.junctions[jid];
    opt_junctionState.controller = j.controller || '';

    opt_junctionState.flash = Array.from(document.querySelectorAll('input[data-j="flash"]:checked')).map(c => c.value);
    ['emgFireSt', 'emgFireTr', 'etcOper', 'etcSpare1'].forEach(k => {
        const c = document.querySelector(`input[data-j="${k}"]`);
        if (c) opt_junctionState[k] = c.checked;
    });

    const finalData = JSON.parse(JSON.stringify(opt_state));
    finalData.summary = JSON.parse(JSON.stringify(opt_junctionState));

    j.optimizerState = finalData;

    // 대시보드 요약 통계(opStats) 동기화
    if (!j.opStats) j.opStats = Array(16).fill(false);
    const activeDirs = OPT_DIRS.filter(d => opt_state[d.id].active).map(d => d.id);
    const count = activeDirs.length;

    // 0:단일, 1:3지, 2:4지, 3:5지, 4:6지+
    [0, 1, 2, 3, 4].forEach(i => j.opStats[i] = false);
    if (count <= 2) j.opStats[0] = true;
    else if (count === 3) j.opStats[1] = true;
    else if (count === 4) j.opStats[2] = true;
    else if (count === 5) j.opStats[3] = true;
    else j.opStats[4] = true;

    // 보호구역: 5:어린이, 6:노인, 7:장애인
    j.opStats[5] = activeDirs.some(id => opt_state[id].children);
    j.opStats[6] = activeDirs.some(id => opt_state[id].elderly);
    j.opStats[7] = activeDirs.some(id => opt_state[id].disabled);

    // 보행/기타: 8:대각선, 9:동시보행, 10:이단, 11:LPI, 12:전일제(항시)점멸, 13:시간제점멸
    j.opStats[8] = activeDirs.some(id => opt_state[id].diagonal);
    j.opStats[9] = activeDirs.some(id => opt_state[id].op.pedSimul);
    j.opStats[10] = activeDirs.some(id => opt_state[id].cwTwo);
    j.opStats[11] = activeDirs.some(id => opt_state[id].op.pedLpi);

    const flashList = opt_junctionState.flash || [];
    j.opStats[12] = flashList.includes('항시점멸');
    j.opStats[13] = flashList.includes('시간제점멸');
}

/**
 * 개별 교차로 일괄 설정 (단일 교차로 타겟)
 */
function syncOptFromSignals() {
    const jid = typeof STATE !== 'undefined' ? STATE.activeJid : null;
    if (!jid || !STATE.junctions[jid]) { alert("교차로를 먼저 선택하세요."); return; }

    if (!confirm("현재 선택된 교차로의 모든 설정이 신호 데이터 기준으로 초기화됩니다. 계속하시겠습니까?")) return;

    const j = STATE.junctions[jid];
    
    // [보정] 기존 상태를 전역 변수에서 즉시 제거하여 초기화 보장
    opt_state = getDefaultOptState();
    opt_selectedIds = []; 
    
    // 신규 상태 생성 및 반영
    const newState = _getSyncedOptState(j);
    opt_state = newState;
    
    // UI에 반영
    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    saveOptToActiveJunction();
    
    // 방향 선택 리셋 (강제로 'N' 또는 첫 번째 활성 방향 선택)
    const firstActive = OPT_DIRS.find(d => opt_state[d.id].active);
    selectOptDir(firstActive ? firstActive.id : 'N');
    
    alert(`[${j.name}] 신호 및 TOD 데이터를 분석하여 상세 운영 속성을 초기화 및 동기화했습니다.`);
}

/**
 * 전체 교차로 일괄 설정 (Bulk Operation)
 */
function syncAllOptFromSignals() {
    const junctions = Object.values(STATE.junctions);
    if (junctions.length === 0) { alert("교차로 데이터가 없습니다."); return; }

    const msg = `전체 교차로(${junctions.length}개)의 운영 통계 데이터를 신호 기반으로 일괄 동기화하시겠습니까?\n\n* 기존에 작성된 상세 운영 데이터는 초기화됩니다.`;
    if (!confirm(msg)) return;

    // 성능을 위해 대규모 업데이트 시 루프 최적화
    junctions.forEach(j => {
        const newState = _getSyncedOptState(j);
        
        // 데이터 직접 반영 (Active Junction UI 동기화는 별도 처리)
        j.optimizerState = newState;
        
        // 대시보드용 요약 속성(opStats) 갱신
        _updateOpStatsSummary(j, newState);
    });

    // 현재 선택된 교차로가 있다면 UI 갱신
    if (STATE.activeJid && STATE.junctions[STATE.activeJid]) {
        const activeJ = STATE.junctions[STATE.activeJid];
        opt_state = JSON.parse(JSON.stringify(activeJ.optimizerState));
        renderOptimizer();
        renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
        if (opt_curId) selectOptDir(opt_curId);
    }

    // 대시보드 통계 및 맵 가시성 루틴 전체 갱신
    if (typeof renderStats === 'function') renderStats();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();

    alert(`전체 ${junctions.length}개 교차로의 운영 통계 일괄 동기화가 완료되었습니다.`);
}

/**
 * [Core Logic] 특정 교차로의 신호 정보를 분석하여 OptState 객체 생성
 */
function _getSyncedOptState(j) {
    const newState = getDefaultOptState();
    
    // 1. 신호 맵 데이터 보완
    if (!j.movA || (j.movA && j.movA.every(v => v === 0))) {
        const currentMapIdx = (typeof STATE !== 'undefined') ? STATE.currentSignalMapIdx : 0;
        const curMap = (j.signalMaps && j.signalMaps[currentMapIdx]) ? j.signalMaps[currentMapIdx] : null;
        if (curMap) {
            j.movA = curMap.movA || Array(8).fill(0);
            j.movB = curMap.movB || Array(8).fill(0);
        }
    }

    // 2. 현재 운영 계획 참조
    const dayIdx = (typeof STATE !== 'undefined') ? STATE.currentJunctionDayTypeIdx : 0;
    const planIdxInput = document.getElementById('current-plan-idx');
    const planIdx = planIdxInput ? (parseInt(planIdxInput.value) || 0) : 0;
    const p = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][planIdx] : null;

    // 3. 방향 매핑 (NEMA)
    const nemaMap = {
        'N': { L: 7, T: 4 }, 'E': { L: 1, T: 6 }, 'S': { L: 3, T: 8 }, 'W': { L: 5, T: 2 },
        'NE': { L: 9, T: 14 }, 'SE': { L: 11, T: 16 }, 'SW': { L: 13, T: 10 }, 'NW': { L: 15, T: 12 }
    };
    const movs = [...(j.movA || []), ...(j.movB || [])];

    Object.keys(nemaMap).forEach(dirId => {
        const target = nemaMap[dirId];
        const s = newState[dirId];
        const hasL = movs.includes(target.L);
        const hasT = movs.includes(target.T);

        if (hasL || hasT) {
            s.active = true;
            s.A.L = hasL ? 1 : 0;
            s.A.T = hasT ? 1 : 0;
            s.A.SPD = 50;
            if (hasL && [1, 3, 5, 7, 9, 11, 13, 15].includes(target.L)) s.op.leftProt = true;

            let pedTimeVal = 0, pedDlyVal = 0;
            if (p) {
                const idxA = (j.movA || []).indexOf(target.T);
                if (idxA !== -1) {
                    pedTimeVal = Math.max(pedTimeVal, (p.pedA || [])[idxA] || 0);
                    pedDlyVal = Math.max(pedDlyVal, (p.pedDelayA || [])[idxA] || 0);
                }
                const idxB = (j.movB || []).indexOf(target.T);
                if (idxB !== -1) {
                    pedTimeVal = Math.max(pedTimeVal, (p.pedB || [])[idxB] || 0);
                    pedDlyVal = Math.max(pedDlyVal, (p.pedDelayB || [])[idxB] || 0);
                }
            }
            if (pedDlyVal > 0) s.op.pedEarly = true;
            if (pedTimeVal > 0) s.A.CW = Math.max(0, pedTimeVal - 7);
        }
    });

    newState.summary = { flash: [], emgFireSt: false, emgFireTr: false, etcOper: false, etcSpare1: false, controller: j.controller || '' };
    return newState;
}

/** 
 * [Helper] 일괄 업데이트 시 개별 교차로의 opStats(대시보드 요약 필드)를 최신화 
 */
function _updateOpStatsSummary(j, stateData) {
    if (!j.opStats) j.opStats = Array(16).fill(false);
    
    const activeDirs = OPT_DIRS.map(d => d.id).filter(id => stateData[id] && stateData[id].active);
    const count = activeDirs.length;

    [0, 1, 2, 3, 4].forEach(i => j.opStats[i] = false);
    if (count <= 2) j.opStats[0] = true;
    else if (count === 3) j.opStats[1] = true;
    else if (count === 4) j.opStats[2] = true;
    else if (count === 5) j.opStats[3] = true;
    else j.opStats[4] = true;

    j.opStats[5] = activeDirs.some(id => stateData[id].children);
    j.opStats[6] = activeDirs.some(id => stateData[id].elderly);
    j.opStats[7] = activeDirs.some(id => stateData[id].disabled);
    j.opStats[8] = activeDirs.some(id => stateData[id].diagonal);
    j.opStats[9] = activeDirs.some(id => stateData[id].op.pedSimul);
    j.opStats[10] = activeDirs.some(id => stateData[id].op.pedLagActive); // cwTwo 대신 실제 op 상태 사용
    j.opStats[11] = activeDirs.some(id => stateData[id].op.pedLpi);
}

// Global Exports
window.initOptimizer = initOptimizer;
window.selectOptDir = selectOptDir;
window.toggleOptActive = toggleOptActive;
window.toggleStatsExpand = toggleStatsExpand;
window.loadOptStateFromJunction = loadOptStateFromJunction;
window.renderOptimizerStats = renderOptimizerStats;
window.syncOptFromSignals = syncOptFromSignals;
window.syncAllOptFromSignals = syncAllOptFromSignals;
window.handleJStatsInput = handleJStatsInput;
window.applyLanePreset = applyLanePreset;

/**
 * 차로 프리셋 적용 (드롭다운)
 */
function applyLanePreset(presetValue) {
    if (!presetValue) return;
    if (opt_selectedIds.length === 0) {
        alert("먼저 왼쪽 다이어그램에서 적용할 방향(노드)을 선택해주세요.");
        document.getElementById('lane-preset-select').value = "";
        return;
    }

    const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, LU: 0, LT: 0, TR: 0, LR: 0 };
    const parts = presetValue.split(',');
    parts.forEach(p => {
        const type = p.replace(/\d+/g, '');
        const count = parseInt(p.replace(/\D+/g, '')) || 0;
        if (lanes[type] !== undefined) {
            lanes[type] = count;
        }
    });

    opt_selectedIds.forEach(id => {
        if (!opt_state[id]) return;
        opt_state[id].active = true;
        // 기존 직진/좌회전/우회전 초기화
        Object.keys(opt_state[id].A).forEach(k => opt_state[id].A[k] = 0);
        // 프리셋 적용
        Object.keys(lanes).forEach(k => {
            if (opt_state[id].A[k] !== undefined) opt_state[id].A[k] = lanes[k];
        });
    });

    document.getElementById('lane-preset-select').value = "";

    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    saveOptToActiveJunction();

    // UI 인풋 박스 동기화 (마지막 선택 노드 기준)
    if (opt_curId && opt_state[opt_curId]) {
        const s = opt_state[opt_curId];
        document.querySelectorAll('#lane-fields-unified input[type="number"]').forEach(i => {
            if (i.dataset.col === 'A') {
                i.value = s.A[i.dataset.type] || 0;
            }
        });
    }
}

// Auto-init on load if elements exist
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('lane-fields-unified')) initOptimizer();
});

function renderTemplatePanel() {
    const container = document.getElementById('opt-template-container');
    if (!container) return;

    const btnStyle = "flex:1; height:28px; background:rgba(0,0,0,0.4); color:#fff; border:1px solid #444; border-radius:4px; font-size:14px; cursor:pointer; display:flex; justify-content:center; align-items:center; transition:0.2s;";
    
    // 템플릿 버튼
    const templateHtml = `
        <div class="sector-header-opt flex-row-between gap-10 mb-5 pb-5 border-b-1" style="color:#2ecc71; border-bottom-color:#444;">
            <span class="fs-12 fw-800">📋 교차로 기하구조</span>
        </div>
        <div style="display: flex; gap: 4px; margin-bottom: 12px; padding: 5px; background:rgba(255,255,255,0.02); border-radius:4px;">
            <button style="${btnStyle}" onclick="applyJunctionTemplate(['N','E','S','W'])" title="4지 교차로">┼</button>
            <button style="${btnStyle}" onclick="applyJunctionTemplate(['E','S','W'])" title="3지 (T자 하단)">ㅗ</button>
            <button style="${btnStyle}" onclick="applyJunctionTemplate(['N','E','S'])" title="3지 (T자 우측)">ㅏ</button>
            <button style="${btnStyle}" onclick="applyJunctionTemplate(['N','E','W'])" title="3지 (T자 상단)">ㅜ</button>
            <button style="${btnStyle}" onclick="applyJunctionTemplate(['N','S','W'])" title="3지 (T자 좌측)">ㅓ</button>
            <button style="${btnStyle}" onclick="applyJunctionTemplate(['E','W'])" title="단일로 (가로)">ㅡ</button>
            <button style="${btnStyle}" onclick="applyJunctionTemplate(['N','S'])" title="단일로 (세로)">ㅣ</button>
        </div>
    `;

    // 프리셋 드롭다운 옵션
    const optionsHtml = `
        <option value="">▼ 차로 구성 프리셋...</option>
        <option value="L1,T1,R1">↰ ↑ ↱ (좌1, 직1, 우1)</option>
        <option value="L2,T1,R1">↰ ↰ ↑ ↱ (좌2, 직1, 우1)</option>
        <option value="L1,T2,R1">↰ ↑ ↑ ↱ (좌1, 직2, 우1)</option>
        <option value="L2,T2,R1">↰ ↰ ↑ ↑ ↱ (좌2, 직2, 우1)</option>
        <option value="L1,T3,R1">↰ ↑ ↑ ↑ ↱ (좌1, 직3, 우1)</option>
        <option value="L2,T3,R1">↰ ↰ ↑ ↑ ↑ ↱ (좌2, 직3, 우1)</option>
        <option value="L1,T3,R2">↰ ↑ ↑ ↑ ↱ ↱ (좌1, 직3, 우2)</option>
        <option value="T1,R1">↑ ↱ (직1, 우1)</option>
        <option value="T2,R1">↑ ↑ ↱ (직2, 우1)</option>
        <option value="T3,R1">↑ ↑ ↑ ↱ (직3, 우1)</option>
        <option value="L1,T1">↰ ↑ (좌1, 직1)</option>
        <option value="L1,T2">↰ ↑ ↑ (좌1, 직2)</option>
        <option value="T2">↑ ↑ (직2)</option>
        <option value="T3">↑ ↑ ↑ (직3)</option>
        <option value="TL1,T1">↰↑ ↑ (직좌1, 직1)</option>
    `;

        // 8개 접근로 횡방향 테이블
    let theadCells = '';
    let tbodyCells = '';
    
    OPT_DIRS.forEach(d => {
        theadCells += `<th style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; width:120px;">
            <label style="cursor:pointer; display:flex; flex-direction:row; align-items:center; justify-content:center; gap:5px;">
                <input type="checkbox" id="chk-preset-${d.id}" onchange="toggleOptActiveFromPanel('${d.id}')">
                ${d.label} (${d.id})
            </label>
        </th>`;
        
        tbodyCells += `<td id="td-preset-${d.id}" style="padding:4px; border:1px solid #444; transition:0.2s;">
            <select class="preset-select" data-dir="${d.id}" onchange="applyLanePresetToDir('${d.id}', this.value)"
                style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                ${optionsHtml}
            </select>
        </td>`;
    });

    const tableHtml = `
        <div class="sector-header-opt flex-row-between gap-10 mb-5 pb-5 border-b-1 mt-10" style="color:#3498db; border-bottom-color:#444;">
            <span class="fs-12 fw-800">🚘 접근로별 차로 일괄 설정</span>
        </div>
        <div style="width: 100%; overflow-x: auto;" class="custom-scroll">
            <table style="width:100%; border-collapse:collapse; background:rgba(0,0,0,0.2); border:1px solid #333; margin-bottom:10px; table-layout:fixed; min-width:800px;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.05);">${theadCells}</tr>
                </thead>
                <tbody>
                    <tr>${tbodyCells}</tr>
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = templateHtml + tableHtml;
}

window.applyJunctionTemplate = function(activeDirs) {
    OPT_DIRS.forEach(d => {
        if (!opt_state[d.id]) return;
        opt_state[d.id].active = activeDirs.includes(d.id);
    });
    
    // 상태 저장 및 UI 갱신
    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    saveOptToActiveJunction();
    window.updateTemplatePanelUI();

    // 첫 번째 활성화된 노드 선택
    const firstActive = OPT_DIRS.find(d => activeDirs.includes(d.id));
    if (firstActive) {
        selectOptDir(firstActive.id);
    }
};

window.applyLanePresetToDir = function(dir, presetValue) {
    if (!presetValue) return;
    if (!opt_state[dir]) return;

    // 해당 방향 강제 활성화
    opt_state[dir].active = true;

    const lanes = { L: 0, T: 0, R: 0, U: 0, C: 0, TL: 0, TR: 0 };
    const parts = presetValue.split(',');
    parts.forEach(p => {
        const type = p.replace(/\d+/g, '');
        const count = parseInt(p.replace(/\D+/g, '')) || 0;
        if (lanes[type] !== undefined) {
            lanes[type] = count;
        }
    });

    // 기존 직진/좌회전/우회전 초기화
    Object.keys(opt_state[dir].A).forEach(k => opt_state[dir].A[k] = 0);
    // 프리셋 적용
    Object.keys(lanes).forEach(k => {
        if (opt_state[dir].A[k] !== undefined) opt_state[dir].A[k] = lanes[k];
    });

    // 드롭다운 선택값 유지
    // 선택한 값을 계속 표시되도록 리셋하지 않음

    renderOptimizer();
    renderOptimizerStats();
    if (typeof updateTemplatePanelUI === 'function') updateTemplatePanelUI();
    saveOptToActiveJunction();
    window.updateTemplatePanelUI();
    
    // 만약 현재 상세 편집 중인 방향이면 입력 필드도 갱신
    if (opt_curId === dir) {
        const s = opt_state[dir];
        document.querySelectorAll('#lane-fields-unified input[type="number"]').forEach(i => {
            if (i.dataset.col === 'A') {
                i.value = s.A[i.dataset.type] || 0;
            }
        });
    }
};

window.toggleOptActiveFromPanel = function(dir) {
    toggleOptActive(dir); // 기존 함수 재사용
    window.updateTemplatePanelUI();
};

window.updateTemplatePanelUI = function() {
    OPT_DIRS.forEach(d => {
        const row = document.getElementById(`td-preset-${d.id}`);
        const chk = document.getElementById(`chk-preset-${d.id}`);
        const sel = document.querySelector(`.preset-select[data-dir="${d.id}"]`);
        
        if (row && chk && sel && opt_state[d.id]) {
            const isActive = opt_state[d.id].active;
            chk.checked = isActive;
            if (isActive) {
                row.style.opacity = '1';
                sel.disabled = false;
            } else {
                row.style.opacity = '0.4';
                sel.disabled = true;
            }
        }
    });
};

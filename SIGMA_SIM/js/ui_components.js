/**
 * ui_components.js
 * ─────────────────────────────────────────────
 * 반복적인 UI 요소 생성 및 관리 (동적 렌더링)
 */

const INFO_FIELDS = [
    { id: 'inp-id', label: 'ID', type: 'text', placeholder: 'ID' },
    { id: 'inp-name', label: '교차로명', type: 'text', placeholder: 'Name' },
    { id: 'inp-seq', label: '연등번호', type: 'text', placeholder: 'Seq' },
    { id: 'inp-police', label: '경찰서', type: 'text', placeholder: 'Police' },
    { id: 'inp-office', label: '구청', type: 'text', placeholder: 'District' },
    { id: 'inp-group-id', label: '그룹 ID', type: 'number', readonly: true, style: 'background:rgba(255,255,255,0.05); color:#888;' },
    { id: 'inp-controller', label: '제어기', type: 'text', placeholder: 'Controller' }
];

const ACTUATION_GROUPS = [
    { key: 'left', title: '좌회전 감응', color: 'var(--accent)' },
    { key: 'grid', title: '앞막힘 예방', color: '#3498db' },
    { key: 'ped', title: '보행자 압버튼', color: '#2ecc71' }
];

/**
 * Sigma UI Renderer Module
 */
const SigmaUI = {
    /**
     * JSON 기반 테이블 렌더링
     */
    renderTable: function (containerId, config) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = `<table class="sigma-table ${config.className || ''}" style="${config.style || ''}" id="${config.tableId || ''}">`;

        if (config.head) {
            html += '<thead><tr>';
            config.head.forEach(h => {
                html += `<th style="${h.style || ''}" class="${h.className || ''}" colspan="${h.colspan || 1}">${h.label || h}</th>`;
            });
            html += '</tr></thead>';
        }

        html += '<tbody>';
        config.rows.forEach(row => {
            html += `<tr class="${row.className || ''}" style="${row.style || ''}">`;
            row.cells.forEach(cell => {
                const tag = cell.tag || 'td';
                const attrStr = cell.attr ? Object.entries(cell.attr).map(([k, v]) => `${k}="${v}"`).join(' ') : '';
                html += `<${tag} class="${cell.className || ''}" style="${cell.style || ''}" ${attrStr}>${cell.content || ''}</${tag}>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        container.innerHTML = html;
    },

    /**
     * JSON 기반 그리드/폼 요소 렌더링
     */
    renderGrid: function (containerId, items, className = '') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = items.map(item => {
            if (item.type === 'input-row') {
                return `
                <div class="info-row-v3 ${item.className || ''}" style="${item.style || ''}">
                    <label>${item.label}</label>
                    <input type="${item.inputType || 'text'}" id="${item.id}" ${item.attr || ''} value="${item.value || ''}">
                    ${item.showId ? `<input type="checkbox" id="${item.showId}" ${item.checked ? 'checked' : ''} onchange="if(typeof refreshVisibleTooltips === 'function') refreshVisibleTooltips()">` : ''}
                </div>`;
            } else if (item.type === 'button') {
                return `<button id="${item.id}" class="${item.className || 'btn-sm'}" onclick="${item.onclick}">${item.label}</button>`;
            }
            return item.content || '';
        }).join('');
    },
    /**
     * 신호 점멸 설정을 위한 그리드 렌더링
     */
    renderFlashGrid(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { list, prefix } = data;
        let html = '';
        for (let m = 1; m <= 16; m++) {
            const isChecked = (list || []).includes(m);
            html += `
                <label class="sigma-check" style="font-size: 11px;">
                    <input type="checkbox" class="inp-flash-mov-${prefix}" value="${m}" ${isChecked ? 'checked' : ''}>
                    <span>${m}</span>
                </label>
            `;
        }
        container.innerHTML = html;
    },

    /**
     * 화살표/신호등 수량 설정을 위한 그리드 렌더링
     */
    renderArrowCountGrid(containerId, junction) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';
        const renderSingle = (m, i, ringCls, ringLbl) => {
            const count = (junction.arrowConfigs[m] && Array.isArray(junction.arrowConfigs[m]))
                ? junction.arrowConfigs[m].length
                : (m > 0 ? 1 : 0);
            return `
                <div class="sigma-input-group" style="text-align:center;">
                    <span style="color:var(--${ringCls}); display:block; font-size:10px; margin-bottom:2px;">${ringLbl}-${i + 1}</span>
                    <input type="number" class="sigma-input inp-arrow-count" data-mov="${m}" value="${count}" min="0" style="padding:2px; text-align:center;">
                </div>
            `;
        };

        junction.movA.forEach((m, i) => html += renderSingle(m, i, 'accent', 'A'));
        junction.movB.forEach((m, i) => html += renderSingle(m, i, 'secondary', 'B'));

        if (!html) html = '<div style="grid-column: span 8; color:var(--text-dim); font-size:11px; padding:10px; text-align:center;">교차로를 선택하세요.</div>';
        container.innerHTML = html;
    },

    renderOpInterventionGrid(containerId, op) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const rows = [
            { label: 'A', ringCls: 'accent', data: op.splitA },
            { label: 'B', ringCls: 'secondary', data: op.splitB }
        ];

        const rowHtml = rows.map(r => `
            <tr>
                <td style="color:var(--${r.ringCls}); font-weight:bold; text-align:center; border:1px solid #333;">${r.label}</td>
                ${r.data.map((v, i) => `
                    <td style="border:1px solid #333;">
                        <input type="number" class="sigma-input inp-op-split${r.label}" data-index="${i}" 
                            value="${v || 0}" style="width:100%; height:20px; text-align:center; padding:0; border:none; background:transparent;">
                    </td>
                `).join('')}
            </tr>
        `).join('');

        container.innerHTML = `
            <table class="sigma-table" style="width:100%; font-size:11px; table-layout: fixed; border-collapse: collapse;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.05);">
                        <th style="width:40px; border:1px solid #333;">링</th>
                        ${Array.from({ length: 8 }, (_, i) => `<th style="border:1px solid #333;">P${i + 1}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>${rowHtml}</tbody>
            </table>
        `;
    }
};

function initUIComponents() {
    renderInfoFields();
    renderSafetyFacilities();
    renderActuationGroups();
}

function renderInfoFields() {
    SigmaUI.renderGrid('info-fields-container', [
        ...INFO_FIELDS.map(f => {
            let syncHandler = "syncActiveJunctionData()";
            if (f.id === 'inp-controller') syncHandler += "; if(typeof renderStats==='function') renderStats(); if(typeof renderJunctionStatsTable==='function') renderJunctionStatsTable();";
            if (f.id === 'inp-name') syncHandler += "; if(typeof renderStats==='function') renderStats(); if(typeof renderJunctionStatsTable==='function') renderJunctionStatsTable();";

            return {
                type: 'input-row',
                label: f.label,
                id: f.id,
                inputType: f.type,
                showId: f.showId,
                checked: f.checked,
                attr: `${f.readonly ? 'readonly' : ''} ${f.style ? `style="${f.style}"` : ''} 
                       ${f.id.includes('inp-') && !f.readonly ? `data-j="${f.id.replace('inp-', '')}" oninput="${syncHandler}"` : ''} 
                       placeholder="${f.placeholder || ''}"`
            };
        }),
        {
            content: `
            <div class="info-row-v3">
                <label>API 매칭번호</label>
                <div style="display: flex; gap: 4px; flex: 1; min-width: 0;">
                    <input type="text" id="inp-api-int-no" class="sigma-input" 
                           style="font-size: 11px; padding: 4px; flex: 1; background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.15);" 
                           oninput="syncActiveJunctionData()" placeholder="API 번호">
                    <button onclick="autoMatchNearestAPIIntersection()" class="btn-sm" 
                            style="padding: 2px 8px; font-size: 9.5px; background: var(--accent); color: #000; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; height: 22px;">
                        자동매칭
                    </button>
                </div>
            </div>`
        },
        {
            content: `
            <div class="info-row-v3">
                <label>위경도</label>
                <div style="display: flex; gap: 3px; flex: 1; min-width: 0;">
                    <input type="number" id="inp-lat" step="0.000000001" class="sigma-input" 
                           style="font-size: 9.5px; padding: 4px; width: 48%; text-align: center; background: rgba(0,0,0,0.2);" 
                           oninput="syncActiveJunctionData()">
                    <input type="number" id="inp-lng" step="0.000000001" class="sigma-input" 
                           style="font-size: 9.5px; padding: 4px; width: 48%; text-align: center; background: rgba(0,0,0,0.2);" 
                           oninput="syncActiveJunctionData()">
                </div>
            </div>`
        }
    ]);
}

function renderSafetyFacilities() {
    const container = document.getElementById('safety-facilities-container');
    if (!container) return;

    const items = [
        { key: 'children', label: '어린이', color: '#f1c40f' },
        { key: 'elderly', label: '노인', color: '#f1c40f' },
        { key: 'disabled', label: '장애인', color: '#f1c40f' },
        { key: 'diagonal', label: '대각선' },
        { key: 'twoStage', label: '이단횡단' },
        { key: 'trafficIsland', label: '교통섬' }
    ];

    const ops = [
        { op: 'residRed', label: '잔여_적색' },
        { op: 'residGreen', label: '잔여_녹색' },
        { op: 'auxA', label: '보조등_좌' },
        { op: 'auxB', label: '보조등_우' },
        { op: 'floorSig', label: '바닥신호' }
    ];

    let html = '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">';
    html += '<div style="display:flex; flex-direction:column; gap:5px;">';
    items.forEach(i => {
        html += `<label class="sigma-check" ${i.color ? `style="color:${i.color};"` : ''}><input type="checkbox" data-key="${i.key}"> ${i.label}</label>`;
    });
    html += '</div><div style="display:flex; flex-direction:column; gap:5px;">';
    ops.forEach(o => {
        html += `<label class="sigma-check"><input type="checkbox" data-op="${o.op}"> ${o.label}</label>`;
    });
    html += '</div></div>';
    container.innerHTML = html;
}

function renderActuationGroups() {
    const container = document.getElementById('actuation-container');
    if (!container) return;

    container.innerHTML = ACTUATION_GROUPS.map(g => `
        <div class="act-row-opt" data-act-group="${g.key}">
            <div class="act-title-row-opt" style="font-size:10px; color:${g.color};">${g.title}</div>
            ${['s', 't'].map(p => {
        let options = ['none', '생략', '조기', '기타'];
        if (g.key === 'grid') options = ['none', '대기검지', '앞막힘제어', '기타'];
        else if (g.key === 'ped') options = ['none', '주기유지', '예약등화'];

        return `
                <div class="act-time-grid-opt" style="grid-template-columns: 35px 1fr; gap:5px; margin-top:5px;">
                    <span>${p === 's' ? '일반' : '시차'}</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="time-range-opt">
                            <input type="text" class="time-box-opt sigma-input" data-act="${g.key}" data-period="${p}" data-field="S" placeholder="00:00">~
                            <input type="text" class="time-box-opt sigma-input" data-act="${g.key}" data-period="${p}" data-field="E" placeholder="00:00">
                        </div>
                        <div class="act-options-opt">
                            ${options.map(val => `
                                <label style="display:inline-flex; align-items:center; gap:2px; font-size:9.5px; opacity:0.8;">
                                    <input type="radio" name="act_${g.key}_${p}" data-act="${g.key}" data-period="${p}" value="${val}" ${val === 'none' ? 'checked' : ''}>${val === 'none' ? '안함' : val}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>`;
    }).join('')}
            <input type="text" id="act-${g.key}-memo" class="act-memo-inp-opt sigma-input" style="display:none;" data-act="${g.key}" data-field="memo" placeholder="설명 키워드 (예: 감응1-2)">
        </div>
    `).join('');
}


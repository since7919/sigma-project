function renderTemplatePanel() {
    const container = document.getElementById('opt-template-container');
    if (!container) return;

    const btnStyle = "flex:1; height:28px; background:rgba(0,0,0,0.4); color:#fff; border:1px solid #444; border-radius:4px; font-size:14px; cursor:pointer; display:flex; justify-content:center; align-items:center; transition:0.2s;";
    
    // 템플릿 버튼
    const templateHtml = `
        <div class="sector-header-opt flex-row-between gap-10 mb-5 pb-5 border-b-1" style="color:#2ecc71; border-bottom-color:#444;">
            <span class="fs-12 fw-800">📋 교차로 현시 템플릿 (Template)</span>
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

    // 8개 접근로 테이블
    let tableRows = '';
    OPT_DIRS.forEach(d => {
        tableRows += `
            <tr id="row-preset-${d.id}" style="border-bottom:1px solid rgba(255,255,255,0.05); transition: 0.2s;">
                <td style="padding:4px 8px; text-align:left; width: 35%;">
                    <label style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#aaa; font-size:11px;">
                        <input type="checkbox" id="chk-preset-${d.id}" onchange="toggleOptActiveFromPanel('${d.id}')">
                        ${d.label} (${d.id})
                    </label>
                </td>
                <td style="padding:4px 8px;">
                    <select class="preset-select" data-dir="${d.id}" onchange="applyLanePresetToDir('${d.id}', this.value)"
                        style="width:100%; height:22px; font-size:11px; background:#111; color:#00d4ff; border:1px solid #444; border-radius:3px; outline:none; cursor:pointer;">
                        ${optionsHtml}
                    </select>
                </td>
            </tr>
        `;
    });

    const tableHtml = `
        <div class="sector-header-opt flex-row-between gap-10 mb-5 pb-5 border-b-1" style="color:#3498db; border-bottom-color:#444;">
            <span class="fs-12 fw-800">🚘 접근로별 차로 일괄 설정</span>
        </div>
        <table style="width:100%; border-collapse:collapse; background:rgba(0,0,0,0.2); border:1px solid #333; margin-bottom:10px;">
            ${tableRows}
        </table>
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

    // 드롭다운 리셋 (선택 후 초기화하여 계속 선택 가능하게 함)
    const sel = document.querySelector(\`.preset-select[data-dir="\${dir}"]\`);
    if (sel) sel.value = "";

    renderOptimizer();
    renderOptimizerStats();
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
        const row = document.getElementById(\`row-preset-\${d.id}\`);
        const chk = document.getElementById(\`chk-preset-\${d.id}\`);
        const sel = document.querySelector(\`.preset-select[data-dir="\${d.id}"]\`);
        
        if (row && chk && sel && opt_state[d.id]) {
            const isActive = opt_state[d.id].active;
            chk.checked = isActive;
            if (isActive) {
                row.style.opacity = '1';
                sel.disabled = false;
            } else {
                row.style.opacity = '0.4';
                sel.disabled = true;
                sel.value = "";
            }
        }
    });
};

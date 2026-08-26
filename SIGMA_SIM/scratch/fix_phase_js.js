const fs = require('fs');
const path = 'SIGMA_SIM/js/phase.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

const target = `/** 요일 타입 전환 UI (주간계획 포함) */
/** 교차로 TOD 상세 섹션 렌더링 (주간계획 포함) */
function updateJunctionDayUI() {
    const container = document.getElementById('j-day-type-buttons');
    if (!container) return;

    const jid = STATE.activeJid;
    const j = jid ? STATE.junctions[jid] : null;
    const weeklyPlan = (j && j.weeklyPlan) ? j.weeklyPlan.split(';') : ["1", "1", "1", "1", "1", "2", "3"];

    const renderBtn = (lab, i) => {
        const isActive = (STATE.currentJunctionDayTypeIdx === i);
        return \`
            <label style="display:flex; align-items:center; gap:4px; font-size:10px; cursor:pointer; 
                          padding:3px 6px; border-radius:4px; border:1px solid \${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.08)'};
                          background: \${isActive ? 'rgba(241,196,15,0.12)' : 'rgba(255,255,255,0.02)'};
                          color: \${isActive ? 'white' : '#777'}; transition: all 0.2s; flex:1; justify-content:center;">
                <input type="radio" name="edit-junction-day" style="width:11px; height:11px; margin:0;" 
                       \${isActive ? 'checked' : ''} onchange="changeJunctionDayType(\${i})">
                <span style="\${isActive ? 'font-weight:bold; color:var(--accent);' : ''}">\${lab}</span>
            </label>
        \`;
    };

    let html = '<div style="display:flex; flex-direction:column; gap:6px; width:100%;">';

    // ── 1행: 주간계획 (Weekly Plan) ──
    const weekLabels = ["월", "화", "수", "목", "금", "토", "일"];
    html += \`
        <div id="weekly-plan-panel" style="background:rgba(255,255,255,0.02); padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap:10px;">
            <div style="font-size:10px; font-weight:bold; color:var(--accent); width:45px; text-align:center;">주간계획</div>
            <div style="display:flex; gap:2px; flex:1;">
                \${weekLabels.map((w, idx) => {
        const planNum = parseInt(weeklyPlan[idx] || 1);
        return \`
                        <div style="display:flex; flex-direction:column; align-items:center; flex:1; padding:2px 0; border-radius:4px; background:rgba(0,0,0,0.25);">
                            <span style="font-size:9px; color:\${idx >= 5 ? '#e74c3c' : '#777'}; font-weight:bold; line-height:1;">\${w}</span>
                            <input type="number" class="sigma-input inp-weekly-plan" data-index="\${idx}" min="1" max="10" 
                                   value="\${planNum}" onchange="updateWeeklyPlanData(\${idx}, this.value)"
                                   style="width:100%; height:16px; font-size:10.5px; font-weight:bold; text-align:center; color:var(--accent); background:transparent; border:none; padding:0; margin-top:1px;">
                        </div>
                    \`;
    }).join('')}
            </div>
        </div>
    \`;

    // 2행: 일계획 버튼군 (일반/시차 통합 스타일)
    html += \`
        <div style="display:flex; flex-direction:column; gap:4px; background:rgba(0,0,0,0.1); padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:10px; color:#aaa; width:45px; font-weight:bold; text-align:center;">일계획 1~5</span>
                <div style="display:flex; gap:2px; flex:1;">
                    \${Array.from({ length: 5 }, (_, i) => renderBtn(DAY_LABELS[i], i)).join('')}
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:10px; color:var(--accent); width:45px; font-weight:bold; opacity:0.7; text-align:center;">시차 6~10</span>
                <div style="display:flex; gap:2px; flex:1;">
                    \${Array.from({ length: 5 }, (_, i) => renderBtn(DAY_LABELS[i + 5], i + 5)).join('')}
                </div>
            </div>
        </div>
    \`;

    html += '</div>';
    container.innerHTML = html;
}`;

const replacement = `function updateJunctionDayUI() {
    renderWeeklyPlanTable();
    renderTodPlanInfoTable();
}

function renderWeeklyPlanTable() {
    const container = document.getElementById('weekly-plan-container');
    if (!container) return;

    const jid = STATE.activeJid;
    const j = jid ? STATE.junctions[jid] : null;
    const weeklyPlan = (j && j.weeklyPlan) ? j.weeklyPlan.split(';') : ["1", "1", "1", "1", "1", "2", "3"];
    const weekLabels = ["월", "화", "수", "목", "금", "토", "일"];
    
    const dayOfWeek = (typeof STATE !== 'undefined' && STATE.simDayOfWeek !== undefined) ? STATE.simDayOfWeek : new Date().getDay();
    const jsToWeeklyMap = [6, 0, 1, 2, 3, 4, 5];
    const currentDayIndex = jsToWeeklyMap[dayOfWeek];

    let html = \`
        <div style="color: #38bdf8; font-weight: bold; font-size: 13px; margin-bottom: 8px;">주간 일계획표</div>
        <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px; border: 1px solid rgba(255,255,255,0.08);">
            <thead>
                <tr style="background: rgba(255,255,255,0.05);">
                    \${weekLabels.map((w, idx) => {
                        const isToday = idx === currentDayIndex;
                        return \`<th style="padding: 6px; color: \${isToday ? 'var(--accent)' : '#94a3b8'}; border: 1px solid rgba(255,255,255,0.08);">\${w}</th>\`;
                    }).join('')}
                </tr>
            </thead>
            <tbody>
                <tr>
                    \${weekLabels.map((w, idx) => {
                        const planNum = parseInt(weeklyPlan[idx] || 1);
                        const isToday = idx === currentDayIndex;
                        return \`
                            <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.08); background: \${isToday ? 'rgba(241,196,15,0.1)' : 'transparent'};">
                                <input type="number" class="sigma-input inp-weekly-plan" data-index="\${idx}" min="1" max="10" 
                                       value="\${planNum}" onchange="updateWeeklyPlanData(\${idx}, this.value)"
                                       style="width:100%; height:20px; font-size:11.5px; font-weight:bold; text-align:center; color:\${isToday ? 'var(--accent)' : '#fff'}; background:transparent; border:none; padding:0;">
                            </td>
                        \`;
                    }).join('')}
                </tr>
            </tbody>
        </table>
    \`;
    container.innerHTML = html;
}

function renderTodPlanInfoTable() {
    const container = document.getElementById('tod-plan-info-container');
    if (!container) return;

    const jid = STATE.activeJid;
    const j = jid ? STATE.junctions[jid] : null;
    if (!j) {
        container.innerHTML = '<div style="padding: 10px; text-align: center; color: #666; font-size: 11.5px;">교차로를 선택해 주세요.</div>';
        return;
    }

    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const pIdx = parseInt(UI.planIdx?.value) || 0;

    STATE._todPlanGroup = STATE._todPlanGroup || 1;
    const group = STATE._todPlanGroup;

    const dayPlanIndices = group === 1 ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];

    let html = \`
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #38bdf8; font-weight: bold; font-size: 13px;">TOD 계획정보 (현재 조회: \${DAY_LABELS[dayIdx]})</span>
            <div style="display: flex; gap: 5px;">
                <button onclick="toggleTodPlanGroup(1)" style="background: \${group === 1 ? '#0ea5e9' : '#334155'}; color: #fff; border: none; padding: 3px 6px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold;">일반맵 (1~5)</button>
                <button onclick="toggleTodPlanGroup(2)" style="background: \${group === 2 ? '#0ea5e9' : '#334155'}; color: #fff; border: none; padding: 3px 6px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold;">시차맵 (6~10)</button>
            </div>
        </div>
        <div style="overflow-x: auto; background: #0f172a; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11px;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.05);">
                        <th style="padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); width: 30px; color: #94a3b8;">#</th>
                        \${dayPlanIndices.map(idx => \`
                            <th colspan="3" onclick="changeJunctionDayType(\${idx})" style="padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); border-left: 1px solid rgba(255,255,255,0.08); color: \${dayIdx === idx ? 'var(--accent)' : '#94a3b8'}; cursor: pointer; font-weight: bold; background: \${dayIdx === idx ? 'rgba(241,196,15,0.05)' : 'transparent'};">
                                \${DAY_LABELS[idx]}
                            </th>
                        \`).join('')}
                    </tr>
                    <tr style="background: rgba(255,255,255,0.03);">
                        <th style="padding: 4px; border-bottom: 1px solid rgba(255,255,255,0.08);"></th>
                        \${dayPlanIndices.map(idx => \`
                            <th style="padding: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); border-left: 1px solid rgba(255,255,255,0.08); font-weight: normal; color: #94a3b8; font-size: 9px;">TIME</th>
                            <th style="padding: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: normal; color: #94a3b8; font-size: 9px;">CYC</th>
                            <th style="padding: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: normal; color: #94a3b8; font-size: 9px;">IDX</th>
                        \`).join('')}
                    </tr>
                </thead>
                <tbody>
                    \${Array.from({length: 16}).map((_, rIdx) => \`
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); background: \${pIdx === rIdx ? 'rgba(255,255,255,0.02)' : 'transparent'};">
                            <td style="padding: 4px; font-weight: bold; color: #64748b;">\${rIdx + 1}</td>
                            \${dayPlanIndices.map(idx => {
                                const sc = (j.schedules && j.schedules[idx]) ? j.schedules[idx][rIdx] : null;
                                const isActive = (dayIdx === idx && pIdx === rIdx && sc && sc.h !== -1);
                                const bg = isActive ? 'rgba(241,196,15,0.12)' : 'transparent';
                                const fontColor = isActive ? 'var(--accent)' : '#cbd5e1';
                                
                                if (!sc || sc.h === -1) {
                                    return \`
                                        <td onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 4px; border-left: 1px solid rgba(255,255,255,0.05); background: \${bg}; color: \${fontColor}; cursor: pointer;">-</td>
                                        <td onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 4px; background: \${bg}; color: \${fontColor}; cursor: pointer;">-</td>
                                        <td onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 4px; background: \${bg}; color: \${fontColor}; font-weight: bold; cursor: pointer;">-</td>
                                    \`;
                                }
                                return \`
                                    <td onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 4px; border-left: 1px solid rgba(255,255,255,0.05); background: \${bg}; color: \${fontColor}; font-family: monospace; cursor: pointer;">\${String(sc.h).padStart(2,'0')}:\${String(sc.m).padStart(2,'0')}</td>
                                    <td onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 4px; background: \${bg}; color: \${fontColor}; cursor: pointer;">\${sc.cycle}</td>
                                    <td onclick="selectTodPlanCell(\${idx}, \${rIdx})" style="padding: 4px; background: \${bg}; color: \${fontColor}; font-weight: bold; cursor: pointer;">\${sc.idx !== undefined ? sc.idx : '-'}</td>
                                \`;
                            }).join('')}
                        </tr>
                    \`).join('')}
                </tbody>
            </table>
        </div>
    \`;
    container.innerHTML = html;
}

window.toggleTodPlanGroup = function(group) {
    if (typeof STATE !== 'undefined') {
        STATE._todPlanGroup = group;
        renderTodPlanInfoTable();
    }
};

window.selectTodPlanCell = function(dayIdx, slotIdx) {
    STATE.currentJunctionDayTypeIdx = dayIdx;
    UI.planIdx.value = slotIdx;
    document.getElementById('j-current-day-label').innerText = \`📅 현재 조회: \${DAY_LABELS[dayIdx]} TOD (TOD SLOT 1~16)\`;
    renderRingTables();
    renderSummaryTable();
    updateJunctionDayUI();
};`;

if (content.includes(target.replace(/\r\n/g, '\n'))) {
    content = content.replace(target.replace(/\r\n/g, '\n'), replacement.replace(/\r\n/g, '\n'));
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replacement successful.");
} else {
    console.log("Target not found!");
}

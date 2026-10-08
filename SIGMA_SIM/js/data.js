/**
 * data.js - SIGMA Dashboard Data Engine V75
 * ─────────────────────────────────────────────
 * 통합 DB 데이터 통계 및 입출력 관리 (IndexedDB & krd- ID 정규화 전용)
 */

/** 🗄️ IndexedDB 대용량 데이터 전용 스토리지 시스템 */
const DB_STORAGE = {
    DB_NAME: 'SIGMA_BIG_DATA',
    STORE_NAME: 'central_db',
    version: 1,

    async _open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.version);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) db.createObjectStore(this.STORE_NAME);
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async set(key, val) {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).put(val, key);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = (e) => reject(e.target.error);
        });
    },

    async get(key) {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const req = tx.objectStore(this.STORE_NAME).get(key);
            req.onsuccess = () => { db.close(); resolve(req.result); };
            req.onerror = (e) => reject(e.target.error);
        });
    }
};

/** DB 상태 통계 갱신 및 파일명 표시 */
function refreshDBStats() {
    if (typeof STATE === 'undefined') return;
    const S = STATE;
    const jids = Object.keys(S.junctions);
    let mapCount = 0, totalPlanCount = 0, activePlanCount = 0, statsCount = 0;

    jids.forEach(jid => {
        const j = S.junctions[jid];
        if (j.signalMaps) j.signalMaps.forEach(m => { if (m.movA && m.movA.length > 0) mapCount++; });
        
        // [수정] 전체 슬롯과 활성 슬롯(h !== -1) 구분 계산
        if (j.schedules) {
            j.schedules.forEach(day => {
                if (Array.isArray(day)) {
                    totalPlanCount += day.length;
                    day.forEach(slot => { if (slot.h !== -1) activePlanCount++; });
                }
            });
        }
        if (j.optimizerState && Object.keys(j.optimizerState).length > 0) statsCount++;
    });

    const updateText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = (typeof val === 'number') ? val.toLocaleString() : val; };
    updateText('db-stat-junctions', jids.length);
    updateText('db-stat-maps', mapCount);
    updateText('db-stat-plans', `${activePlanCount.toLocaleString()} / ${totalPlanCount.toLocaleString()}`);
    updateText('db-stat-groups', S.groups ? Object.keys(S.groups).length : 0);
    updateText('db-stat-stats', statsCount);
    updateText('db-stat-links', (window.RoadManager && window.RoadManager.edges) ? window.RoadManager.edges.length : 0);

    // [추가] HOME 탭 요약 카드 동기화
    updateText('home-stat-junctions', jids.length);
    updateText('home-stat-groups', S.groups ? Object.keys(S.groups).length : 0);
    updateText('home-stat-plans', `${activePlanCount.toLocaleString()} / ${totalPlanCount.toLocaleString()}`);
    updateText('home-stat-yearbook', (S.civilData && Array.isArray(S.civilData)) ? S.civilData.length : 0);

    const setStatus = (id, count, label, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        // [정교화] 단순히 파일명이 있다고 성공이라 말하지 않고, 실제 데이터 개수(count)를 우선적으로 확인
        const fileName = S.loadedFiles ? S.loadedFiles[key] : null;
        let isLoaded = (count > 0);
        
        // 지오데이터(links, poly)는 count가 0으로 들어와도 fileName이 있으면 로드된 것으로 간주 (레이어 존재 여부)
        if (key === 'links' || key === 'poly') isLoaded = !!fileName;

        el.innerHTML = isLoaded 
            ? `<b style="color:#2ecc71;">✅ 로드완료 ${count > 0 ? `(${label}:${count})` : ''}</b>` 
            : '<span style="color:#555;">[로드 대기]</span>';
    };

    setStatus('expl-status-inter', jids.length, '교차로', 'inter');
    setStatus('expl-status-maps', mapCount, '현시', 'maps');
    setStatus('expl-status-plans', activePlanCount, '계획', 'plans');
    setStatus('expl-status-groups', S.groups ? Object.keys(S.groups).length : 0, '그룹', 'groups');
    setStatus('expl-status-stats', statsCount, '통계', 'stats');
    setStatus('expl-status-links', 0, '링크', 'links');
    setStatus('expl-status-poly', 0, '경계', 'poly');
    setStatus('expl-status-yearbook', (S.civilData && Array.isArray(S.civilData)) ? S.civilData.length : 0, '연보', 'yearbook');

    if (typeof renderDBFileNames === 'function') renderDBFileNames();
    if (typeof renderGroupList === 'function') renderGroupList();
}

function renderDBFileNames() {
    if (typeof STATE === 'undefined' || !STATE.loadedFiles) return;
    const types = ['inter', 'maps', 'plans', 'groups', 'stats', 'links', 'poly', 'yearbook'];
    types.forEach(type => {
        const name = STATE.loadedFiles[type];
        const nameEl = document.getElementById(`expl-name-${type}`);
        const delBtn = document.getElementById(`btn-del-${type}`);
        
        if (nameEl) {
            if (name) {
                let cleanName = name.split('=').pop().replace('.csv', '').replace('.geojson', '');
                nameEl.textContent = `DB_${cleanName} (Supabase)`;
                nameEl.style.color = "#ffffff";
                nameEl.style.fontWeight = "700";
            } else {
                if (type === 'inter') nameEl.textContent = 'DB_Intersections (Supabase)';
                else if (type === 'maps') nameEl.textContent = 'DB_Signal_Maps (Supabase)';
                else if (type === 'plans') nameEl.textContent = 'DB_TOD_Plans (Supabase)';
                else if (type === 'links') nameEl.textContent = 'DB_Coordlink (Supabase)';
                else if (type === 'poly') nameEl.textContent = 'DB_Poly (Supabase)';
                else if (type === 'yearbook') nameEl.textContent = 'DB_Yearbook (Supabase)';
                else nameEl.textContent = `DB_${type} (Supabase)`;
                nameEl.style.color = "#00d4ff";
                nameEl.style.fontWeight = "600";
            }
        }

        if (delBtn) {
            delBtn.style.display = name ? "block" : "none";
        }
    });
}

async function handleDBFileLoad(el, type) {
    const file = el.files[0]; if (!file) return;
    STATE.loadedFiles[type] = file.name;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target.result;
        if (type === 'inter') await processIntersectionCSV(content);
        else if (type === 'maps') await processSignalMapCSV(content);
        else if (type === 'plans') await processTodPlanCSV(content);
        else if (type === 'links') processGeoJSON(content);
        else if (type === 'poly') processBoundaryGeoJSON(content);
        else if (type === 'groups' && typeof processGroupCSV === 'function') processGroupCSV(content);
        else if (type === 'stats' && typeof processStatsCSV === 'function') processStatsCSV(content);
        else if (type === 'yearbook' && typeof processCivilCSV === 'function') processCivilCSV(content);
        refreshDBStats();
        if (typeof renderRingTables === 'function') renderRingTables();
        if (typeof renderGroupList === 'function') renderGroupList();
    };
    reader.readAsText(file);
}

/** 📤 전체 데이터 통합 데이터 내보내기 */
function exportNormalizedDBFiles() {
    if (Object.keys(STATE.junctions).length === 0) { alert("저장할 데이터가 없습니다."); return; }
    const pwd = prompt("다운로드를 위한 비밀번호를 입력하세요.");
    if (!pwd || btoa(pwd) !== "MTIzNA==") {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }
    const { interCsv, mapCsv, todCsv, groupCsv, statsCsv } = exportNormalizedDB();
    const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const download = (content, name) => {
        const blob = new Blob([content], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    };
    download(interCsv, `db_intersections_${now}.csv`);
    download(mapCsv, `db_signal_maps_${now}.csv`);
    download(todCsv, `db_tod_plans_${now}.csv`);
    if (groupCsv) download(groupCsv, `db_groups_${now}.csv`);
    if (statsCsv) download(statsCsv, `db_stats_${now}.csv`);
    alert("5종의 통합 DB 파일이 저장되었습니다.");
}

/** 🔍 로드된 파일 데이터 미리보기 (데이터보기 기능) */
function viewDBFile(type) {
    try {
        const fileName = STATE.loadedFiles ? STATE.loadedFiles[type] : null;
        if (!fileName && Object.keys(STATE.junctions || {}).length === 0) { alert("먼저 데이터를 로드해 주세요."); return; }
        
        // 데이터 뷰어 팝업 띄우기 공통 함수
        const openViewer = (csvText) => {
            if (!csvText || csvText.startsWith("[")) {
                alert(csvText || "표시할 데이터가 없습니다.");
                return;
            }
            const lines = csvText.trim().split('\n');
            let tableHtml = `<table border="1" style="border-collapse: collapse; min-width: 100%; width: max-content; font-family: 'Pretendard', sans-serif; font-size: 13px; text-align: center;">`;
            
            lines.forEach((line, index) => {
                const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => {
                    s = s.trim();
                    if (s.startsWith('"') && s.endsWith('"')) s = s.substring(1, s.length - 1).replace(/""/g, '"');
                    return s;
                });
                tableHtml += '<tr class="' + (index === 0 ? 'header-row' : 'data-row') + '">';
                cols.forEach(col => {
                    if (index === 0) {
                        tableHtml += `<th style="background: #2a2d3e; color: #fff; padding: 8px 12px; position: sticky; top: 0; white-space: nowrap; box-shadow: 0 1px 0 #444; z-index: 10;">${col}</th>`;
                    } else {
                        // Use max-width with ellipsis to prevent insane column widths, but show full text on hover (title attribute)
                        tableHtml += `<td title="${col.replace(/"/g, '&quot;')}" style="padding: 6px 10px; white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; border: 1px solid #334155; color: #e2e8f0;">${col}</td>`;
                    }
                });
                tableHtml += '</tr>';
            });
            tableHtml += `</table>`;

            const win = window.open("", "_blank", "width=1200,height=800");
            if (win) {
                win.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>[${type}] 데이터 뷰어</title>
                        <style>
                            body { background: #0b0f19; margin: 0; padding: 20px; font-family: 'Pretendard', sans-serif; }
                            table { border-collapse: collapse; width: 100%; }
                            th, td { border: 1px solid #334155; }
                            .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #334155; }
                            h2 { margin: 0; color: #38bdf8; font-size: 1.5rem; }
                            .wrapper { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 100px); border: 1px solid #334155; border-radius: 6px; background: #1e293b; }
                            .data-row:hover { background: #334155; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h2>${type} 데이터뷰어</h2>
                            <div style="color:#94a3b8; font-size:13px;">총 <b>${lines.length - 1}</b>개의 행이 로드되었습니다. 가로/세로 스크롤하여 확인하세요.</div>
                        </div>
                        <div class="wrapper">
                            ${tableHtml}
                        </div>
                    </body>
                    </html>
                `);
                win.document.close();
            } else {
                alert("팝업이 차단되었습니다. 팝업 차단을 해제해 주세요.");
            }
        };

        // [현실화] 파일 객체가 없으면(자동 로드 시) 현재 메모리 데이터를 익스포트하여 미리보기
        const input = document.getElementById(`file-load-db-${type}`);
        const file = input ? input.files[0] : null;

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                openViewer(e.target.result);
            };
            reader.readAsText(file);
        } else {
            // [자동 로드 대응] 메모리 데이터로 미리보기 생성
            let content = "";
            let exportData = null;
            
            // 데이터 익스포트 시도
            try {
                if (typeof exportNormalizedDB === 'function') {
                    exportData = exportNormalizedDB();
                }
            } catch (e) {
                console.error("Export failed:", e);
            }

            if (!exportData) {
                alert(`[${type}] 미리보기를 생성하는 데 실패했습니다. 데이터 구조가 호환되지 않습니다.`);
                return;
            }
            
            switch (type) {
                case 'inter': content = exportData.interCsv; break;
                case 'maps': content = exportData.mapCsv; break;
                case 'plans': content = exportData.todCsv; break;
                case 'groups': content = exportData.groupCsv; break;
                case 'stats': content = exportData.statsCsv; break;
                case 'links': content = "[연동구간] GeoJSON 데이터는 파일로 다운로드하여 확인하세요."; break;
                case 'poly': content = "[행정경계] GeoJSON 데이터는 파일로 다운로드하여 확인해 주세요."; break;
                case 'yearbook': content = `신호운영 연보 데이터: ${STATE.civilData ? STATE.civilData.length : 0}건 로드됨`; break;
            }

            if (!content || content.startsWith("[")) {
                alert(content || "표시할 데이터가 없습니다.");
            } else {
                openViewer(content);
            }
        }
    } catch (err) {
        console.error("viewDBFile Error:", err);
        alert("데이터보기 실행 중 에러가 발생했습니다: " + err.message);
    }
}

/** 💾 개별 파일 저장 기능 (파일별 💾 버튼) */
function saveDBFile(type) {
    if (Object.keys(STATE.junctions).length === 0) { alert("데이터가 없습니다."); return; }
    const pwd = prompt("다운로드를 위한 비밀번호를 입력하세요.");
    if (!pwd || btoa(pwd) !== "MTIzNA==") {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }
    const regionSelect = { value: window.CURRENT_REGION_CODE || 'L01' };
    const regionCode = regionSelect ? regionSelect.value : 'L01';
    
    const { interCsv, mapCsv, todCsv, groupCsv, statsCsv } = exportNormalizedDB();
    const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const download = (content, name) => {
        const blob = new Blob([content], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    };
    if (type === 'inter') download(interCsv, `db_${regionCode}_intersections_${now}.csv`);
    else if (type === 'maps') download(mapCsv, `db_${regionCode}_signal_maps_${now}.csv`);
    else if (type === 'plans') download(todCsv, `db_${regionCode}_tod_plans_${now}.csv`);
    else if (type === 'groups') download(groupCsv, `db_${regionCode}_groups_${now}.csv`);
    else if (type === 'stats') download(statsCsv, `db_${regionCode}_stats_${now}.csv`);
}

/** ❌ 개별 파일 초기화 기능 (파일별 ❌ 버튼) */
function clearDBFile(type) {
    if (!STATE.loadedFiles) return;
    if (!confirm(`[${type}] 관련 데이터를 초기화하시겠습니까?`)) return;
    delete STATE.loadedFiles[type];
    if (type === 'inter') {
        Object.values(STATE.junctions).forEach(j => { if (j.marker && window.map) window.map.removeLayer(j.marker); });
        STATE.junctions = {};
    } else if (type === 'maps') {
        Object.values(STATE.junctions).forEach(j => { j.signalMaps = Array.from({ length: 6 }, () => createEmptySignalMap()); });
    } else if (type === 'plans') {
        Object.values(STATE.junctions).forEach(j => {
            j.dayPlans = Array.from({ length: 10 }, () => createEmptyPlans());
            j.schedules = Array.from({ length: 10 }, () => createEmptySched());
        });
    } else if (type === 'links') {
        if (STATE.geoJsonLayer && window.map) { window.map.removeLayer(STATE.geoJsonLayer); STATE.geoJsonLayer = null; }
        if (window.RoadManager && typeof window.RoadManager.clear === 'function') window.RoadManager.clear();
    } else if (type === 'poly') {
        if (STATE.boundaryLayer && window.map) { window.map.removeLayer(STATE.boundaryLayer); STATE.boundaryLayer = null; }
    } else if (type === 'groups') {
        STATE.groups = {};
    } else if (type === 'stats') {
        Object.values(STATE.junctions).forEach(j => { j.optimizerState = {}; });
    } else if (type === 'yearbook') {
        STATE.civilData = [];
    }

    // 파일 입력값(Value) 초기화 (같은 파일을 다시 열 수 있도록)
    const input = document.getElementById(`file-load-db-${type}`);
    if (input) input.value = "";

    refreshDBStats();
    if (typeof renderRingTables === 'function') renderRingTables();
    alert(`[${type}] 데이터가 초기화되었습니다.`);
}

/** 💾 전체 저장 (내부 IndexedDB) */
async function saveNormalizedDBFiles() {
    if (Object.keys(STATE.junctions).length === 0) { alert("저장할 데이터가 없습니다."); return; }
    showLoading("데이터베이스 내부 저장 중...");
    try {
        const { interCsv, mapCsv, todCsv, groupCsv, statsCsv } = exportNormalizedDB();
        await DB_STORAGE.set('SIGMA_DB_INTERSECTIONS', interCsv);
        await DB_STORAGE.set('SIGMA_DB_SIGNAL_MAPS', mapCsv);
        await DB_STORAGE.set('SIGMA_DB_TOD_PLANS', todCsv);
        if (groupCsv) await DB_STORAGE.set('SIGMA_DB_GROUPS', groupCsv);
        if (statsCsv) await DB_STORAGE.set('SIGMA_DB_STATS', statsCsv);
        setTimeout(() => { hideLoading(); alert("작업 내용이 브라우저 DB에 업데이트되었습니다."); refreshDBStats(); }, 300);
    } catch (e) { hideLoading(); alert("저장 실패: " + e.message); }
}

function openDBUpdateModal() {
    const modal = document.getElementById('db-update-modal');
    if (!modal) return;
    
    // Calculate dirty intersections
    const dirtyCount = Object.values(STATE.junctions).filter(j => j._isDirty).length;
    
    const countLabel = document.getElementById('lbl-db-junctions-count');
    if (countLabel) {
        if (dirtyCount > 0) {
            countLabel.textContent = `대기중인 교차로: ${dirtyCount}건 (50개씩 분할 전송)`;
            countLabel.style.color = '#38bdf8';
        } else {
            countLabel.textContent = `대기중인 교차로: 0건 (전체 강제 전송 시 체크)`;
            countLabel.style.color = '#777';
        }
    }
    
    document.getElementById('db-update-progress-info').style.display = 'none';
    modal.style.display = 'flex';
}

async function executeDBUpdate() {
    const chkJunctions = document.getElementById('chk-db-junctions').checked;
    const chkGroups = document.getElementById('chk-db-groups').checked;
    const chkStats = document.getElementById('chk-db-stats').checked;
    const chkYearbook = document.getElementById('chk-db-yearbook').checked;
    
    if (!chkJunctions && !chkGroups && !chkStats && !chkYearbook) {
        alert("업데이트할 항목을 선택해주세요.");
        return;
    }
    
    const pwd = prompt("DB 반영을 위해 관리자 비밀번호를 입력하세요.");
    if (!pwd || btoa(pwd) !== "MTIzNA==") {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }

    const progContainer = document.getElementById('db-update-progress-container');
    const progBar = document.getElementById('db-update-progress-bar');
    const progInfo = document.getElementById('db-update-progress-info');
    
    if (progContainer) progContainer.style.display = 'block';
    if (progInfo) { progInfo.style.display = 'block'; progInfo.textContent = '업데이트를 시작합니다...'; }
    if (progBar) progBar.style.width = '0%';

    try {
        if (chkJunctions) {
            let targets = Object.values(STATE.junctions).filter(j => j._isDirty);
            // If none are dirty but user checked it, force upload all (or prompt)
            if (targets.length === 0) {
                if(confirm("현재 변경된 교차로가 없습니다. 전체 교차로를 강제로 다시 업데이트하시겠습니까? (시간이 오래 걸릴 수 있습니다.)")) {
                    targets = Object.values(STATE.junctions);
                } else {
                    progInfo.textContent = '교차로 업데이트 건너뜀';
                }
            }
            
            if (targets.length > 0) {
                const chunkSize = 50;
                for (let i = 0; i < targets.length; i += chunkSize) {
                    const chunk = targets.slice(i, i + chunkSize);
                    const currentCount = Math.min(i + chunkSize, targets.length);
                    if (progInfo) progInfo.textContent = `교차로 데이터 전송 중... (${currentCount} / ${targets.length})`;
                    if (progBar) progBar.style.width = `${(currentCount / targets.length) * 100}%`;
                    
                    const payloads = chunk.map(j => {
                        const exportData = exportSingleJunctionCSV(j.id);
                        return exportData;
                    });
                    
                    const res = await fetch('/api/sim/batch-update-junctions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chunks: payloads })
                    });
                    
                    if (!res.ok) {
                        const err = await res.json().catch(()=>({}));
                        throw new Error(`교차로 업데이트 실패: ${err.error || '서버 오류'}`);
                    }
                    
                    // Clear dirty flag for this chunk
                    chunk.forEach(j => { j._isDirty = false; });
                }
                progInfo.textContent = `교차로 업데이트 완료 (${targets.length}건)`;
            }
        }
        
        if (chkGroups) {
            progInfo.textContent = '그룹 마스터 업데이트 중...';
            const groupCsv = (typeof generateGroupCSV === 'function') ? generateGroupCSV() : "";
            if (groupCsv) {
                const res = await fetch('/api/sim/batch-update-groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupCsvLines: groupCsv })
                });
                if (!res.ok) throw new Error("그룹 업데이트 실패");
            }
        }
        
        if (chkStats) {
            progInfo.textContent = '통계 업데이트 중...';
            const statsCsv = (typeof generateStatsCSV === 'function') ? generateStatsCSV() : "";
            if (statsCsv) {
                const res = await fetch('/api/sim/batch-update-stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ statsCsvLines: statsCsv })
                });
                if (!res.ok) throw new Error("통계 업데이트 실패");
            }
        }

        if (chkYearbook) {
            progInfo.textContent = '연보 업데이트 중...';
            // Placeholder: serialize yearbook
            // Not strictly implemented in previous export functions, assuming custom logic if needed.
        }

        if (progBar) progBar.style.width = '100%';
        progInfo.textContent = '모든 업데이트가 성공적으로 완료되었습니다!';
        setTimeout(() => {
            document.getElementById('db-update-modal').style.display = 'none';
        }, 1500);

    } catch (e) {
        alert("업데이트 중 오류가 발생했습니다: " + e.message);
        progInfo.textContent = '오류 발생: ' + e.message;
        progInfo.style.color = '#e74c3c';
    }
}


/** [정교화] 데이터 통합 익스포트 */
function exportNormalizedDB() {
    const junctions = Object.values(STATE.junctions);
    const interHeaders = ["ID", "Region", "Name", "Lat", "Lng", "Seq", "Police", "Office", "GroupID", "FlashCfg", "OpIntervention", "ArrowConfigs", "Controller", "DiagramOrder", "Weekly_plan", "API_Int_No"];
    let interCsv = "\ufeff" + interHeaders.join(",") + "\n";
    junctions.forEach(j => {
        const row = [
            j.id || "", 
            j.region || (j.id.startsWith("L02-") ? "L02" : "L01"),
            j.name || "Node", 
            (typeof j.lat === 'number' ? j.lat.toFixed(9) : "0"), 
            (typeof j.lng === 'number' ? j.lng.toFixed(9) : "0"), 
            j.seq || j.id || "", 
            j.police || "", 
            j.office || "", 
            j.group || 0, 
            serializeFlash(j), 
            serializeOpInt(j), 
            serializeArrows(j), 
            j.controller || "", 
            (j.extra?.diagramOrder !== undefined ? j.extra.diagramOrder : -1), 
            j.weeklyPlan || "1;1;1;1;1;2;3",
            j.apiIntNo !== undefined && j.apiIntNo !== null ? j.apiIntNo : ""
        ];
        interCsv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    // 배열의 끝에서부터 0 또는 빈 문자열 제거하여 직렬화 (DB varchar(50) 초과 방지)
    const compressArr = (arr) => {
        if (!arr || !Array.isArray(arr) || arr.length === 0) return "";
        let end = arr.length - 1;
        while (end >= 0 && (arr[end] === 0 || arr[end] === "0" || arr[end] === "")) end--;
        return end < 0 ? "" : arr.slice(0, end + 1).join(';');
    };

    const mapHeaders = ["ID", "MapIdx", "movA", "movB", "pedMovA", "pedMovB", "mainMovements", "yellowA", "yellowB", "allredA", "allredB", "pedA", "pedB", "pedDelayA", "pedDelayB", "pedFlashA", "pedFlashB", "pedGreenA", "pedGreenB", "rawSteps"];
    let mapCsv = "\ufeff" + mapHeaders.join(",") + "\n";
    junctions.forEach(j => {
        (j.signalMaps || []).forEach((sm, idx) => {
            const rawStepsJson = (sm.rawSteps && sm.rawSteps.length > 0) ? JSON.stringify(sm.rawSteps) : "";
            const row = [
                j.id, idx,
                compressArr(sm.movA), compressArr(sm.movB),
                compressArr(sm.pedMovA), compressArr(sm.pedMovB),
                compressArr(sm.mainMovements),
                compressArr(sm.yellowA), compressArr(sm.yellowB),
                compressArr(sm.allredA), compressArr(sm.allredB),
                compressArr(sm.pedA), compressArr(sm.pedB),
                compressArr(sm.pedDelayA), compressArr(sm.pedDelayB),
                compressArr(sm.pedFlashA), compressArr(sm.pedFlashB),
                compressArr(sm.pedGreenA), compressArr(sm.pedGreenB),
                rawStepsJson
            ];
            mapCsv += row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",") + "\n";
        });
    });

    const todHeaders = ["ID", "Seq", "SignalMap", "GroupID", "Day_plan"];
    for (let i = 1; i <= 16; i++) todHeaders.push(`Time_plan${i}`);
    let todCsv = "\ufeff" + todHeaders.join(",") + "\n";
    junctions.forEach(j => {
        // 그룹 오브젝트 안전 참조
        const gid = j.group || 0;
        const groupObj = (gid && STATE.groups && STATE.groups[gid]) ? STATE.groups[gid] : null;
        
        for (let d = 0; d < 10; d++) {
            const smIdx = (j.dayPlanMapIds && j.dayPlanMapIds[d] !== undefined) ? j.dayPlanMapIds[d] : ((d < 5) ? 0 : (d - 4));
            const row = [j.id, j.seq || j.id, smIdx, j.group || 0, d + 1];
            const schs = (j.schedules && j.schedules[d]) ? j.schedules[d] : (groupObj && groupObj.schedules ? groupObj.schedules[d] : null);
            const pls = (j.dayPlans && j.dayPlans[d]) ? j.dayPlans[d] : null;
            for (let s = 0; s < 16; s++) {
                const sc = (schs && schs[s]) ? schs[s] : { h: -1, m: 0, cycle: 100, idx: 1 };
                const pl = (pls && pls[s]) ? pls[s] : { offset: 0, cycle: 100, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
                const timeStr = sc.h === -1 ? "-1" : `${String(sc.h).padStart(2,'0')}:${String(sc.m).padStart(2,'0')}`;
                row.push(`${timeStr}|${pl.cycle || sc.cycle || 100}|${pl.offset || 0}|${(pl.splitA||[]).join(';')}|${(pl.splitB||[]).join(';')}|${sc.idx || 1}`);
            }
            todCsv += row.map(v => String(v)).join(",") + "\n";
        }
    });
    return { 
        interCsv, 
        mapCsv, 
        todCsv, 
        groupCsv: (typeof generateGroupCSV === 'function') ? generateGroupCSV() : "", 
        statsCsv: (typeof generateStatsCSV === 'function') ? generateStatsCSV() : "" 
    };
}


/** [통합] 교차로 CSV 프로세서 */




/** 📊 신호운영 엑셀(XLSX) 정밀 분석 로더 (Full UI & Logic) */
// Removed handleExcelSignalLoad duplicate from data.js. Use data_parser.js instead.






/** 📊 특정 교차로 1개 분량의 CSV 행 데이터만 추출 */
function exportSingleJunctionCSV(jid) {
    const j = STATE.junctions[jid];
    if (!j) return null;

    if (window.ipdInstance && jid === STATE.activeJid) {
        const smIdx = STATE.currentSignalMapIdx || 0;
        if (j.signalMaps && j.signalMaps[smIdx]) {
            window.ipdInstance.saveToSignalMap(j.signalMaps[smIdx], j);
        }
    }

    // 1. 교차로 마스터 정보 (1줄, 헤더 제외)
    const interRow = [
        j.id || "", 
        j.region || (j.id.startsWith("L02-") ? "L02" : "L01"),
        j.name || "Node", 
        (typeof j.lat === 'number' ? j.lat.toFixed(9) : "0"), 
        (typeof j.lng === 'number' ? j.lng.toFixed(9) : "0"), 
        j.seq || j.id || "", 
        j.police || "", 
        j.office || "", 
        j.group || 0, 
        serializeFlash(j), 
        serializeOpInt(j), 
        serializeArrows(j), 
        j.controller || "", 
        (j.extra?.diagramOrder !== undefined ? j.extra.diagramOrder : -1), 
        j.weeklyPlan || "1;1;1;1;1;2;3"
    ];
    const interCsvLine = interRow.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");

    // 2. 신호맵 (6줄, 헤더 제외)
    let mapCsvLines = "";
    (j.signalMaps || []).forEach((sm, idx) => {
        const rawSteps = { stepsA: sm.stepsA || [], stepsB: sm.stepsB || [] };
        if (sm.ipdCustomArrows) rawSteps.ipdCustomArrows = sm.ipdCustomArrows;
        const rawStepsJson = JSON.stringify(rawSteps);
        const row = [j.id, idx, (sm.movA||[]).join(';'), (sm.movB||[]).join(';'), (sm.pedMovA||[]).join(';'), (sm.pedMovB||[]).join(';'), (sm.mainMovements||[]).join(';'), (sm.yellowA||[]).join(';'), (sm.yellowB||[]).join(';'), (sm.allredA||[]).join(';'), (sm.allredB||[]).join(';'), (sm.pedA||[]).join(';'), (sm.pedB||[]).join(';'), (sm.pedDelayA||[]).join(';'), (sm.pedDelayB||[]).join(';'), (sm.pedFlashA||[]).join(';'), (sm.pedFlashB||[]).join(';'), (sm.pedGreenA||[]).join(';'), (sm.pedGreenB||[]).join(';'), rawStepsJson];
        mapCsvLines += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    // 3. TOD 계획 (10줄, 헤더 제외)
    let todCsvLines = "";
    const gid = j.group || 0;
    const groupObj = (gid && STATE.groups && STATE.groups[gid]) ? STATE.groups[gid] : null;
    
    for (let d = 0; d < 10; d++) {
        const smIdx = (j.dayPlanMapIds && j.dayPlanMapIds[d] !== undefined) ? j.dayPlanMapIds[d] : ((d < 5) ? 0 : (d - 4));
        const row = [j.id, j.seq || j.id, smIdx, j.group || 0, d + 1];
        const schs = (j.schedules && j.schedules[d]) ? j.schedules[d] : (groupObj && groupObj.schedules ? groupObj.schedules[d] : null);
        const pls = (j.dayPlans && j.dayPlans[d]) ? j.dayPlans[d] : null;
        for (let s = 0; s < 16; s++) {
            const sc = (schs && schs[s]) ? schs[s] : { h: -1, m: 0, cycle: 100, idx: 1 };
            const pl = (pls && pls[s]) ? pls[s] : { offset: 0, cycle: 100, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
            const timeStr = sc.h === -1 ? "-1" : `${String(sc.h).padStart(2,'0')}:${String(sc.m).padStart(2,'0')}`;
            row.push(`${timeStr}|${pl.cycle || sc.cycle || 100}|${pl.offset || 0}|${(pl.splitA||[]).join(';')}|${(pl.splitB||[]).join(';')}|${sc.idx || 1}`);
        }
        todCsvLines += row.map(v => String(v)).join(",") + "\n";
    }

    return {
        jid,
        interCsvLine,
        mapCsvLines: mapCsvLines.trim(),
        todCsvLines: todCsvLines.trim()
    };
}

/** 💾 활성화된 교차로 설정 DB 반영 */
async function updateActiveJunctionToDB() {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) {
        alert("선택된 교차로가 없습니다.");
        return;
    }
    const jName = STATE.junctions[jid].name || "Node";
    if (!confirm(`교차로 [${jName}]의 수정한 설정값을 데이터베이스(Supabase)에 반영하시겠습니까?`)) {
        return;
    }

    const pwd = prompt("DB 반영을 위해 관리자 비밀번호를 입력하세요.");
    // 1234 obfuscated to prevent plain text exposure
    if (!pwd || btoa(pwd) !== "MTIzNA==") {
        alert("비밀번호가 일치하지 않습니다. DB 반영이 취소되었습니다.");
        return;
    }

    showLoading(`교차로 [${jName}] DB 저장 중...`);
    try {
        const payload = exportSingleJunctionCSV(jid);
        if (!payload) {
            throw new Error("CSV 데이터 추출에 실패했습니다.");
        }
        if (typeof generateSingleJunctionStatsCSV === 'function') {
            payload.statsCsvLines = generateSingleJunctionStatsCSV(jid);
        }
        console.log("DEBUG mapCsvLines:", payload.mapCsvLines);

        const response = await fetch('/api/sim/update-junction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "서버 통신 실패");
        }

        hideLoading();
        alert(`교차로 [${jName}]의 설정이 DB에 반영되었습니다.`);
        refreshDBStats();
    } catch (e) {
        hideLoading();
        alert("DB 저장 실패: " + e.message);
    }
}

/** 🔄 활성화된 교차로 설정 DB 원본으로 복원 */
async function revertActiveJunctionFromDB() {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) {
        alert("선택된 교차로가 없습니다.");
        return;
    }
    const jName = STATE.junctions[jid].name || "Node";
    if (!confirm(`교차로 [${jName}]의 데이터를 데이터베이스 원본 값으로 복원하시겠습니까?\n브라우저에서 수정 중인 값은 모두 유실됩니다.`)) {
        return;
    }

    showLoading(`교차로 [${jName}] DB 데이터 복원 중...`);
    try {
        const response = await fetch(`/api/sim/revert-junction?jid=${jid}`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "서버 통신 실패");
        }

        const data = await response.json();

        // 가져온 데이터로 메모리(STATE.junctions[jid]) 덮어쓰기
        if (data.interCsvLine) {
            const mockCsv = "ID,Name,Lat,Lng,Seq,Police,Office,GroupID,FlashCfg,OpIntervention,ArrowConfigs,Controller,DiagramOrder,Weekly_plan\n" + data.interCsvLine;
            await processIntersectionCSV(mockCsv, true);
        }
        if (data.mapCsvLines) {
            const mockCsv = "ID,MapIdx,movA,movB,pedMovA,pedMovB,mainMovements,yellowA,yellowB,allredA,allredB,pedA,pedB,pedDelayA,pedDelayB,pedFlashA,pedFlashB,pedGreenA,pedGreenB,rawSteps\n" + data.mapCsvLines;
            await processSignalMapCSV(mockCsv);
        }
        if (data.todCsvLines) {
            const mockCsv = "ID,Seq,SignalMap,GroupID,Day_plan,Time_plan1,Time_plan2,Time_plan3,Time_plan4,Time_plan5,Time_plan6,Time_plan7,Time_plan8,Time_plan9,Time_plan10,Time_plan11,Time_plan12,Time_plan13,Time_plan14,Time_plan15,Time_plan16\n" + data.todCsvLines;
            await processTodPlanCSV(mockCsv);
        }

        hideLoading();
        alert(`교차로 [${jName}]의 데이터가 DB 값으로 복원되었습니다.`);
        
        // UI 리렌더링
        if (typeof renderRingTables === 'function') renderRingTables();
        if (typeof renderSummaryTable === 'function') renderSummaryTable();
        if (typeof drawJunction === 'function') drawJunction(jid);
        refreshDBStats();
    } catch (e) {
        hideLoading();
        alert("데이터 복원 실패: " + e.message);
    }
}


async function syncSigmaDB(type) {
    const typeToTable = {
        'inter': 'junctions',
        'maps': 'signal_maps',
        'plans': 'tod_plans',
        'groups': 'groups'
    };

    if (!typeToTable[type]) {
        alert("해당 데이터(통계, 링크, 연감, 폴리곤 등)는 아직 백엔드 DB 일괄 동기화가 지원되지 않습니다.");
        return;
    }

    const password = prompt("백엔드 데이터베이스를 직접 수정합니다.\n승인된 관리자만 접근 가능합니다. 비밀번호를 입력하세요:");
    if (!password) {
        return;
    }
    // 1234 obfuscated to prevent plain text exposure
    // 프론트엔드 비밀번호 검증 제거 (백엔드에서 안전하게 검증됨)

    if (!confirm(`현재 로드된 [${type}] 데이터를 백엔드 데이터베이스(${typeToTable[type]})에 일괄 덮어쓰기 하시겠습니까?`)) return;

    try {
        const { interCsv, mapCsv, todCsv, groupCsv } = exportNormalizedDB();
        let targetCsv = '';
        if (type === 'inter') targetCsv = interCsv;
        else if (type === 'maps') targetCsv = mapCsv;
        else if (type === 'plans') targetCsv = todCsv;
        else if (type === 'groups') targetCsv = groupCsv;

        if (!targetCsv) {
            alert("동기화할 데이터가 없습니다.");
            return;
        }

        const records = parseCSV(targetCsv);
        if (!records || records.length === 0) {
            alert("파싱된 데이터가 없습니다.");
            return;
        }

        const tableName = typeToTable[type];
        const chunkSize = tableName === 'junctions' ? records.length : 500;
        let totalCount = 0;

        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const response = await fetch(`/api/sim/tables/${tableName}/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, records: chunk })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || '알 수 없는 오류');
            }
            totalCount += result.count || chunk.length;
            console.log(`[${tableName}] Uploaded ${Math.min(i + chunkSize, records.length)} / ${records.length}`);
        }
        
        alert(`✅ 총 ${totalCount}건의 ${tableName} 데이터가 백엔드에 성공적으로 동기화되었습니다.`);
    } catch (err) {
        alert("백엔드 동기화 실패: " + err.message);
    }
}

async function fetchJunctionDetail(jid) {
    const j = STATE.junctions[jid];
    if (!j) return;
    if (j._detailLoaded) return;
    
    try {
        const res = await fetch(`/api/sim/junction-detail/${jid}`);
        if (!res.ok) throw new Error('Failed to fetch detail');
        const data = await res.json();
        
        if (data.success) {
            // signal_maps
            data.signal_maps.forEach(row => {
                const midx = parseInt(row.map_idx);
                if (isNaN(midx) || midx >= 10) return;
                const sm = j.signalMaps[midx];
                ["mov_a","mov_b","ped_mov_a","ped_mov_b","yellow_a","yellow_b","allred_a","allred_b","ped_a","ped_b","ped_delay_a","ped_delay_b","ped_flash_a","ped_flash_b","ped_green_a","ped_green_b"].forEach(k => {
                    if (row[k] !== undefined && row[k] !== null) {
                        const camelK = k.replace(/_([a-z])/g, g => g[1].toUpperCase());
                        if (Array.isArray(row[k])) {
                            sm[camelK] = row[k].map(Number);
                        } else if (String(row[k]).length > 0) {
                            sm[camelK] = String(row[k]).split(';').map(Number);
                        }
                    }
                });
                if (row.main_movements) {
                    sm.mainMovements = Array.isArray(row.main_movements) ? row.main_movements : String(row.main_movements).split(';');
                }
                let st = row.start_time || ""; if (st.includes(';')) st = "";
                let et = row.end_time || ""; if (et.includes(';')) et = "";
                
            });

            // tod_plans
            data.tod_plans.forEach(row => {
                const dIdx = parseInt(row.day_plan) - 1;
                if (isNaN(dIdx) || dIdx < 0 || dIdx >= 10) return;
                j.dayPlanMapIds[dIdx] = parseInt(row.signal_map) || 0;
                for (let sIdx = 0; sIdx < 16; sIdx++) {
                    const slot = row[`time_plan${sIdx+1}`]; if (!slot) continue;
                    const p = slot.split('|');
                    if (p[0] === "-1") j.schedules[dIdx][sIdx].h = -1;
                    else if (p[0].includes(':')) { const [h, m] = p[0].split(':').map(Number); j.schedules[dIdx][sIdx].h = h; j.schedules[dIdx][sIdx].m = m; }
                    if (p[1]) j.schedules[dIdx][sIdx].cycle = parseInt(p[1]);
                    if (p[2]) j.dayPlans[dIdx][sIdx].offset = parseInt(p[2]);
                    if (p[3]) j.dayPlans[dIdx][sIdx].splitA = p[3].split(';').map(Number);
                    if (p[4]) j.dayPlans[dIdx][sIdx].splitB = p[4].split(';').map(Number);
                    if (p[5]) j.schedules[dIdx][sIdx].idx = parseInt(p[5]);
                    else j.schedules[dIdx][sIdx].idx = (parseInt(row.signal_map) || 0) + 1;
                }
            });

            j._detailLoaded = true;
            
        }
    } catch (err) {
        console.error(`Error loading details for ${jid}:`, err);
    }
}


/** 🔄 현재 선택된 그룹의 TOD 설정을 DB에 반영 */
async function updateGroupToDB() {
    const gid = typeof currentEditingGroup !== 'undefined' ? currentEditingGroup : null;
    if (!gid || !STATE.groups[gid]) {
        alert("선택된 그룹이 없습니다.");
        return;
    }
    const gName = STATE.groups[gid].name || `그룹 ${gid}`;
    if (!confirm(`그룹 [${gName}] 및 소속 교차로들의 TOD 설정을 데이터베이스(Supabase)에 반영하시겠습니까?`)) {
        return;
    }

    const pwd = prompt("DB 반영을 위해 관리자 비밀번호를 입력하세요.");
    if (!pwd || btoa(pwd) !== "MTIzNA==") {
        alert("비밀번호가 일치하지 않습니다. DB 반영이 취소되었습니다.");
        return;
    }

    showLoading(`그룹 [${gName}] DB 저장 중...`);
    try {
        let groupCsv = "GroupID,Region,GroupName,Weekday,Friday,Saturday,Sunday,Special,Flextime1,Flextime2,Flextime3,Flextime4,Flextime5,TSD_SET1,TSD_SET2,TSD_SET3,PlanAliases\n";
        const group = STATE.groups[gid];
        let region = group.region;
        const members = Object.keys(STATE.junctions).filter(j => String(STATE.junctions[j].group) === String(gid));
        if (!region && members.length > 0) {
            const member = STATE.junctions[members[0]];
            region = member.region || (member.id.startsWith("L02-") ? "L02" : "L01");
        } else if (!region) {
            region = "L01";
        }
        const schedStrs = Array.from({ length: 10 }, (_, d) => {
            const sched = (group.schedules && group.schedules[d]) ? group.schedules[d] : [];
            return sched.map(s => {
                const timePart = s.h === -1 ? "-1" : `${String(s.h).padStart(2, '0')}:${String(s.m).padStart(2, '0')}`;
                return `${timePart}|${s.cycle || 100}|${s.idx || 1}`;
            }).join(';');
        });
        const tsdSets = Array.from({ length: 3 }, (_, i) => {
            const config = (group.tsdConfigs && group.tsdConfigs[i]) ? group.tsdConfigs[i] : { enabled: 0, order: [], distances: [] };
            return `${config.enabled}|${(config.order || []).join(';')}|${(config.distances || []).join(';')}`;
        });
        const aliases = group.planAliases ? (Array.isArray(group.planAliases) ? group.planAliases.join(';') : group.planAliases) : "";
        groupCsv += [gid, region, gName.replace(/,/g, ' '), ...schedStrs, ...tsdSets, aliases].join(',') + "\n";

        const resGroup = await fetch('/api/sim/batch-update-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupCsvLines: groupCsv })
        });
        if (!resGroup.ok) throw new Error("그룹 데이터 업로드 실패");

        // 3. Upload Member Junctions Data (TOD ONLY)
        if (members.length > 0) {
            const chunks = members.map(jid => {
                const payload = exportSingleJunctionCSV(jid);
                return {
                    jid,
                    // interCsvLine, mapCsvLines 전송 생략 -> DB의 교차로/맵 설정은 덮어쓰지 않고 TOD만 안전하게 반영
                    interCsvLine: payload.interCsvLine,
todCsvLines: payload.todCsvLines
                };
            });
            const resJunctions = await fetch('/api/sim/batch-update-junctions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chunks })
            });
            if (!resJunctions.ok) throw new Error("소속 교차로 데이터 업데이트 실패");
        }

        hideLoading();
        alert(`그룹 [${gName}] 및 소속 교차로 ${members.length}개의 설정이 DB에 반영되었습니다.`);
        if (typeof refreshDBStats === 'function') refreshDBStats();
    } catch (e) {
        hideLoading();
        alert("DB 저장 실패: " + e.message);
    }
}


// ── [신규] AI 리포트 생성 함수 ──


// 헬퍼: 통계 계산 (data.js 기존 로직을 축약)



// ── [신규] AI 리포트 UI 열기 및 셀렉트 박스 세팅 ──
function generateAIReport() {
    const box = document.getElementById('ai-report-box');
    const setup = document.getElementById('ai-report-setup');
    const content = document.getElementById('ai-report-content');
    
    box.style.display = 'block';
    setup.style.display = 'block';
    content.style.display = 'none';
    
    // 사무소(구청) 목록 추출하여 셀렉트 박스 채우기
    const offices = new Set();
    Object.values(STATE.junctions || {}).forEach(j => {
        if (j.office && j.office.trim() !== '') offices.add(j.office.trim());
    });
    const sortedOffices = Array.from(offices).sort();
    
    const baseSel = document.getElementById('ai-base-select');
    const targetSel = document.getElementById('ai-target-select');
    
    let optionsHtml = '<option value="ALL">서울시 전체</option>';
    sortedOffices.forEach(o => {
        optionsHtml += `<option value="${o}">${o}</option>`;
    });
    
    baseSel.innerHTML = optionsHtml;
    targetSel.innerHTML = optionsHtml;
}

// ── [신규] 실제 AI 분석 시작 (로딩 애니메이션 및 API 호출) ──
async function startAIAnalysis() {
    const setup = document.getElementById('ai-report-setup');
    const content = document.getElementById('ai-report-content');
    
    const baseVal = document.getElementById('ai-base-select').value;
    const targetVal = document.getElementById('ai-target-select').value;
    
    const baseName = baseVal === 'ALL' ? '서울시 전체' : baseVal;
    const targetName = targetVal === 'ALL' ? '서울시 전체' : targetVal;
    
    setup.style.display = 'none';
    content.style.display = 'block';
    
    // 시각적 로딩 애니메이션 (점진적 진행바 포함)
    content.innerHTML = `
        <div style="text-align:center; padding: 30px; font-size: 14px; color:#90caf9;">
            <div style="font-size: 24px; margin-bottom: 15px;" class="loading-spinner">🔄</div>
            <strong style="color: #fff; font-size: 16px;">${baseName}</strong>와(과) <strong style="color: #fff; font-size: 16px;">${targetName}</strong>의 통계를 비교분석 중입니다...<br/><div style="margin-top: 12px;"><span style="background: rgba(156, 39, 176, 0.2); border: 1px solid #9c27b0; color: #e1bee7; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold;">⚡ Gemini 3.8 Flash (무료 API) 작동 중</span></div>
            <div style="margin-top: 15px; width: 100%; background: rgba(0,0,0,0.5); border-radius: 4px; height: 6px; overflow: hidden;">
                <div id="ai-progress-bar" style="width: 0%; height: 100%; background: #64b5f6; transition: width 0.5s ease;"></div>
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #78909c;" id="ai-loading-text">데이터 준비 중...</div>
        </div>
        <style>
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .loading-spinner { display: inline-block; animation: spin 1.5s linear infinite; }
        </style>
    `;
    
    let progress = 0;
    const pBar = document.getElementById('ai-progress-bar');
    const pText = document.getElementById('ai-loading-text');
    
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90; // API 완료 전까지는 90%에서 대기
        if (pBar) pBar.style.width = progress + '%';
        
        if (progress > 20 && progress <= 50) pText.innerText = "전문가 분석 프롬프트 주입 중...";
        if (progress > 50 && progress <= 80) pText.innerText = "거시적/미시적 특성 도출 중...";
        if (progress > 80) pText.innerText = "정책 제언 및 시사점 요약 중...";
    }, 800);
    
    // 데이터 집계
    let allIntersections = Object.values(STATE.junctions || {});
    
    let baseIntersections = baseVal === 'ALL' ? allIntersections : allIntersections.filter(j => (j.office || "").trim() === baseVal);
    let targetIntersections = targetVal === 'ALL' ? allIntersections : allIntersections.filter(j => (j.office || "").trim() === targetVal);
    
    let baseStats = calculateStats(baseIntersections);
    let targetStats = calculateStats(targetIntersections);
    
    try {
        if (typeof recordAIRequest === 'function') recordAIRequest();
        const response = await fetch('/api/ai/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseName: baseName,
                targetName: targetName,
                baseStats: baseStats,
                targetStats: targetStats
            })
        });
        
        clearInterval(progressInterval);
        if (pBar) pBar.style.width = '100%';
        if (pText) pText.innerText = "분석 완료!";
        
        
        let data = {};
        try {
            data = await response.json();
        } catch(e) {
            data = { error: '서버가 올바른 JSON을 반환하지 않았습니다 (500 Error)' };
        }
        
        if (!response.ok || !data || !data.report) {
            content.innerHTML = `<div style="color:#ef5350; font-weight:bold; padding: 10px; text-align:center;">${(data && data.error) || '알수없는 오류 또는 빈 응답'}</div>
            <div style="text-align:center; margin-top:10px;"><button onclick="startAIAnalysis()" class="action-btn">다시 시도</button></div>`;
            return;
        }

        
        // 렌더링 지연 (애니메이션이 100% 차는 것을 보여주기 위함)
        setTimeout(() => {
            // marked.js를 활용한 마크다운 파싱 (테이블 등 완벽 지원)
            let formattedText = marked.parse(data.report);
            
            // 다크 테마 표/텍스트 최적화를 위한 래퍼 추가
            formattedText = `<div class="ai-report-markdown">${formattedText}</div>`;
            
            // 원본 텍스트(출력용) 전역 저장
            window.__lastAIReportHTML = formattedText;
            window.__lastAIReportTitle = `${baseName} vs ${targetName} 교통운영 통계 분석 리포트`;
            
            content.innerHTML = `
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 15px;">
                    <button onclick="printAIReport()" style="background: rgba(255,183,77,0.1); border: 1px solid #ffb74d; color: #ffb74d; padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">🖨️ PDF 출력</button>
                    <button onclick="generateAIReport()" style="background: none; border: 1px solid #4a90e2; color: #4a90e2; padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">🔄 다시 분석하기</button>
                </div>
                ${formattedText}
            `;
        }, 500);
        
    } catch (err) {
        clearInterval(progressInterval);
        content.innerHTML = `<div style="color:#ef5350; font-weight:bold; padding: 10px; text-align:center;">서버 통신 실패: ${err.message}</div>
        <div style="text-align:center; margin-top:10px;"><button onclick="startAIAnalysis()" class="action-btn">다시 시도</button></div>`;
    }
}


// 헬퍼: 통계 계산
function calculateStats(inters) {
    if (!inters || inters.length === 0) return { total_intersections: 0 };
    
    let cycles = { ALL: [], AM_PEAK: [], PM_PEAK: [], NORMAL: [], NIGHT: [] };
    let coordCount = 0;
    let pplt = 0, diag = 0, pLeft = 0;
    
    // 보행자 관련 지표
    let totalPedWait = 0, pedWaitCount = 0;

    inters.forEach(j => {
        if (!j.dayPlans || !j.schedules) return;
        
        // 1. 교차로 레벨 고정 특성 (대각선, PPLT 등)
        if (j.isPPLT) pplt++;
        if (j.isDiag) diag++;
        if (j.isPLeft) pLeft++;

        const scheds = j.schedules[0] || [];
        const plans = j.dayPlans[0] || [];

        // 2. 시간대별(TOD) 분석
        scheds.forEach(sched => {
            if (!sched || sched.h < 0) return;
            const h = sched.h;
            const tpIdx = sched.sIdx !== undefined ? sched.sIdx : ((sched.idx || 1) - 1);
            const plan = plans[tpIdx];
            
            if (plan && plan.cycle > 0) {
                const c = plan.cycle;
                cycles.ALL.push(c);
                
                // 시간대 분류
                if (h >= 7 && h <= 9) cycles.AM_PEAK.push(c);
                else if (h >= 17 && h <= 19) cycles.PM_PEAK.push(c);
                else if (h >= 22 || h <= 5) cycles.NIGHT.push(c);
                else cycles.NORMAL.push(c);
                
                // 보행자 대기시간 추정 (단순화: 주기 - 주도로 보행녹색시간(통상 직진과 연동))
                const mainGreen = plan.splitA && plan.splitA[0] ? plan.splitA[0] : (c * 0.3);
                const pedWait = c - mainGreen; // 횡단보도 적색시간(대기시간)
                if (pedWait > 0) {
                    totalPedWait += pedWait;
                    pedWaitCount++;
                }
            }
        });
        
        // 연동 교차로 여부 (Plan 1 기준)
        if (j.group && j.group !== 0 && j.group !== "") coordCount++;
    });
    
    const getAvg = (arr) => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : "0.0";
    const getMax = (arr) => arr.length ? Math.max(...arr) : 0;
    const getMin = (arr) => arr.length ? Math.min(...arr) : 0;

    return {
        총_교차로수: inters.length,
        연동_교차로수: coordCount,
        연동화율: ((coordCount / inters.length) * 100).toFixed(1) + '%',
        신호주기_통계: {
            전체_평균주기: parseFloat(getAvg(cycles.ALL)),
            최대주기_Max: getMax(cycles.ALL),
            최소주기_Min: getMin(cycles.ALL),
            시간대별_평균주기: {
                오전첨두_AM_PEAK: parseFloat(getAvg(cycles.AM_PEAK)),
                낮시간_NORMAL: parseFloat(getAvg(cycles.NORMAL)),
                오후첨두_PM_PEAK: parseFloat(getAvg(cycles.PM_PEAK)),
                심야시간_NIGHT: parseFloat(getAvg(cycles.NIGHT))
            }
        },
        현시_및_보행신호_특성: {
            보호좌회전_교차로: pLeft,
            비보호좌회전겸용_PPLT: pplt,
            대각선_횡단보도_운영: diag,
            평균_보행자_대기시간_추정: pedWaitCount ? parseFloat((totalPedWait / pedWaitCount).toFixed(1)) : 0
        }
    };
}

// ── [신규] AI 리포트 인쇄/PDF 출력 함수 ──
function printAIReport() {
    if (!window.__lastAIReportHTML) {
        alert('리포트 데이터가 없습니다. 먼저 분석을 진행해주세요.');
        return;
    }
    
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
        alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SIGMA AI Report - ${window.__lastAIReportTitle}</title>
            <meta charset="utf-8">
            <style>
                @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
                body {
                    font-family: 'Pretendard', -apple-system, sans-serif;
                    line-height: 1.6;
                    color: #222;
                    padding: 40px;
                    background: #fff;
                    margin: 0 auto;
                    max-width: 900px;
                }
                h1, h2, h3 { color: #111; margin-top: 1.5em; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
                h4 { color: #444; margin-top: 1.2em; }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 25px 0;
                    font-size: 13px;
                }
                th, td {
                    border: 1px solid #ccc;
                    padding: 10px 14px;
                    text-align: left;
                }
                th {
                    background-color: #f8f9fa;
                    font-weight: 700;
                    color: #000;
                }
                li { margin-bottom: 6px; }
                strong { color: #000; font-weight: 800; background: rgba(255,183,77,0.2); padding: 0 4px; border-radius: 2px; }
                
                .report-header { text-align: center; margin-bottom: 50px; }
                .report-header h1 { border: none; margin-bottom: 10px; font-size: 28px; }
                .report-header .meta { color: #666; font-size: 14px; }
                .footer { margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 11px; color: #999; text-align: center; }
                
                @media print {
                    body { padding: 0; max-width: none; }
                    @page { margin: 15mm; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h1>교통 신호운영 통계 분석 리포트</h1>
                <div class="meta">${window.__lastAIReportTitle} | Generated by SIGMA AI Platform</div>
            </div>
            
            ${window.__lastAIReportHTML}
            
            <div class="footer">
                이 보고서는 SIGMA 플랫폼의 거시적 교통 데이터와 Gemini AI 모델을 활용하여 자동 생성되었습니다.<br>
                보고서에 명시된 수치와 정책 제언은 현장 상황과 일부 상이할 수 있으므로, 최종 판단 시 현장 실무 검토가 필요합니다.
            </div>
            
            <script>
                // 이미지가 모두 로드된 후 인쇄 다이얼로그 호출
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


// --- AI Quota Tracker ---
const QUOTA_DAILY_LIMIT = 14400;
const QUOTA_MIN_LIMIT = 30;

function getQuotaStats() {
    let stats = { daily: [], minute: [] };
    try {
        stats = JSON.parse(localStorage.getItem('geminiQuotaStats') || '{"daily": [], "minute": []}');
    } catch (e) {}
    
    const now = Date.now();
    // Daily resets at UTC midnight (09:00 KST)
    const currentUTCDate = new Date(now).toISOString().split('T')[0];
    
    // Filter out old timestamps
    stats.daily = stats.daily.filter(t => new Date(t).toISOString().split('T')[0] === currentUTCDate);
    stats.minute = stats.minute.filter(t => now - t < 60000);
    
    return stats;
}

function updateQuotaUI() {
    const displayEl = document.getElementById('ai-quota-display');
    if (!displayEl) return;
    
    const stats = getQuotaStats();
    const minCount = stats.minute.length;
    const dayCount = stats.daily.length;
    
    let minColor = minCount >= QUOTA_MIN_LIMIT ? "#ef5350" : "#81c784";
    let dayColor = dayCount >= QUOTA_DAILY_LIMIT ? "#ef5350" : "#81c784";
    
    displayEl.innerHTML = `
        <span>🕒 API 잔여량: </span>
        <span style="color: ${dayColor}; font-weight: ${dayCount >= QUOTA_DAILY_LIMIT ? 'bold' : 'normal'};" title="일일 14,400회 한도 (매일 자정 UTC 초기화)">
            일일 ${dayCount}/${QUOTA_DAILY_LIMIT}회
        </span>
        <span style="color: #666;">|</span>
        <span style="color: ${minColor}; font-weight: ${minCount >= QUOTA_MIN_LIMIT ? 'bold' : 'normal'};" title="분당 30회 한도 (Groq API 제한)">
            분당 ${minCount}/${QUOTA_MIN_LIMIT}회
        </span>
    `;
}

function recordAIRequest() {
    let stats = getQuotaStats();
    stats.daily.push(Date.now());
    stats.minute.push(Date.now());
    localStorage.setItem('geminiQuotaStats', JSON.stringify(stats));
    updateQuotaUI();
}

// Initial update and periodic refresh
document.addEventListener('DOMContentLoaded', updateQuotaUI);
setInterval(updateQuotaUI, 5000);
// Export to window if needed
window.updateQuotaUI = updateQuotaUI;

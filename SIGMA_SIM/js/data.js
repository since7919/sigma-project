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
    reader.onload = (e) => {
        const content = e.target.result;
        if (type === 'inter') processIntersectionCSV(content);
        else if (type === 'maps') processSignalMapCSV(content);
        else if (type === 'plans') processTodPlanCSV(content);
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
        if (!fileName) { alert("먼저 파일을 로드해 주세요."); return; }
        
        // 데이터 뷰어 팝업 띄우기 공통 함수
        const openViewer = (csvText) => {
            if (!csvText || csvText.startsWith("[")) {
                alert(csvText || "표시할 데이터가 없습니다.");
                return;
            }
            const lines = csvText.trim().split('\n');
            let tableHtml = `<table border="1" style="border-collapse: collapse; width: 100%; font-family: 'Pretendard', sans-serif; font-size: 13px; text-align: center;">`;
            
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
                        tableHtml += `<td style="padding: 6px 10px; white-space: nowrap; border: 1px solid #334155; color: #e2e8f0;">${col}</td>`;
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
    const regionSelect = document.getElementById('api-region-select');
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

    const mapHeaders = ["ID", "MapIdx", "movA", "movB", "pedMovA", "pedMovB", "mainMovements", "yellowA", "yellowB", "allredA", "allredB", "pedA", "pedB", "pedDelayA", "pedDelayB", "pedFlashA", "pedFlashB", "pedGreenA", "pedGreenB", "startTime", "endTime"];
    let mapCsv = "\ufeff" + mapHeaders.join(",") + "\n";
    junctions.forEach(j => {
        (j.signalMaps || []).forEach((sm, idx) => {
            const row = [j.id, idx, (sm.movA||[]).join(';'), (sm.movB||[]).join(';'), (sm.pedMovA||[]).join(';'), (sm.pedMovB||[]).join(';'), (sm.mainMovements||[]).join(';'), (sm.yellowA||[]).join(';'), (sm.yellowB||[]).join(';'), (sm.allredA||[]).join(';'), (sm.allredB||[]).join(';'), (sm.pedA||[]).join(';'), (sm.pedB||[]).join(';'), (sm.pedDelayA||[]).join(';'), (sm.pedDelayB||[]).join(';'), (sm.pedFlashA||[]).join(';'), (sm.pedFlashB||[]).join(';'), (sm.pedGreenA||[]).join(';'), (sm.pedGreenB||[]).join(';'), sm.startTime||"", sm.endTime||""];
            mapCsv += row.map(v => String(v)).join(",") + "\n";
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
                const pl = (pls && pls[s]) ? pls[s] : { offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
                const timeStr = sc.h === -1 ? "-1" : `${String(sc.h).padStart(2,'0')}:${String(sc.m).padStart(2,'0')}`;
                row.push(`${timeStr}|${sc.cycle || 100}|${pl.offset || 0}|${(pl.splitA||[]).join(';')}|${(pl.splitB||[]).join(';')}|${sc.idx || 1}`);
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

function serializeFlash(j) { return `${j.flashEnable?1:0}|${(j.flashTimes||[]).map(t=>`${t.s},${t.e}`).join(';')}|${(j.flashYellows||[]).join(';')}|${(j.flashReds||[]).join(';')}`; }
function serializeOpInt(j) { const op = j.opIntervention||{enable:false,rows:[]}; return `${op.enable?1:0}|${(op.rows||[]).map(r=>`${r.s},${r.e},${r.cycle},${r.offset},${(r.splitA||[]).join(';')},${(r.splitB||[]).join(';')}`).join('::')}`; }
function serializeArrows(j) { return Object.entries(j.arrowConfigs||{}).flatMap(([m, configs]) => configs.map(c => `${m}:${c.dLat}:${c.dLng}:${c.rot}`)).join(';'); }

/** [통합] 교차로 CSV 프로세서 */
function processIntersectionCSV(csv) {
    const lines = csv.trim().split(/\r?\n/); if (lines.length < 2) return;
    const firstLine = lines[0].replace(/^\ufeff/, '').trim();
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const getCol = (cols, names) => {
        const normalize = (s) => String(s||"").replace(/\s+/g,'').toLowerCase();
        for (const name of names) {
            const idx = headers.findIndex(h => normalize(h) === normalize(name));
            if (idx !== -1) return cols[idx];
        }
        return null;
    };
    const newJuncts = {};
    for (let i = 1; i < lines.length; i++) {
        const cols = [], line = lines[i]; let start = 0, inQ = false;
        for (let c = 0; c < line.length; c++) {
            if (line[c] === '"') inQ = !inQ;
            else if (line[c] === delimiter && !inQ) { cols.push(line.substring(start, c).replace(/^"|"$/g,'').trim()); start = c + 1; }
        }
        cols.push(line.substring(start).replace(/^"|"$/g,'').trim());
        let id = getCol(cols, ["ID", "교차로번호", "No", "JID"]); if (!id) continue;
        const region = getCol(cols, ["Region", "지역"]) || (id.startsWith("L02-") ? "L02" : "L01");
        const apiIntNoRaw = getCol(cols, ["API_Int_No", "api_int_no", "apiIntNo"]);
        const apiIntNo = apiIntNoRaw ? parseInt(apiIntNoRaw, 10) : null;
        newJuncts[id] = {
            id, region, name: getCol(cols, ["Name", "이름", "교차로명"]) || "Node",
            lat: parseFloat(getCol(cols, ["Lat", "위도"])) || 37.5, lng: parseFloat(getCol(cols, ["Lng", "경도"])) || 127.0,
            seq: getCol(cols, ["Seq", "연등번호"]), police: getCol(cols, ["Police", "경찰서"]) || "", office: getCol(cols, ["Office", "관리청"]) || "",
            group: parseInt(getCol(cols, ["GroupID", "그룹ID"])) || 0, weeklyPlan: getCol(cols, ["Weekly_plan"]) || "1;1;1;1;1;2;3",
            apiIntNo: isNaN(apiIntNo) ? null : apiIntNo,
            signalMaps: Array.from({ length: 6 }, () => createEmptySignalMap()), dayPlans: Array.from({ length: 10 }, () => createEmptyPlans()),
            schedules: Array.from({ length: 10 }, () => createEmptySched()), dayPlanMapIds: new Array(10).fill(0), extra: {}
        };
        headers.forEach((h, idx) => { if (cols[idx] !== undefined) newJuncts[id].extra[h] = cols[idx]; });
        const dOrder = getCol(cols, ["DiagramOrder", "Order"]);
        if (dOrder !== null) newJuncts[id].extra.diagramOrder = parseInt(dOrder);
        parseExtraConfigs(newJuncts[id], newJuncts[id].extra);
    }
    Object.values(STATE.junctions).forEach(j => { if (j.marker && window.map) window.map.removeLayer(j.marker); });
    STATE.junctions = newJuncts;
    Object.keys(STATE.junctions).forEach(jid => { if (typeof drawJunction === 'function') drawJunction(jid); });
    refreshDBStats();
}

function processSignalMapCSV(csv) {
    const rows = parseCSV(csv);
    rows.forEach(row => {
        let jid = row["ID"] || row["id"]; if (!jid || !STATE.junctions[jid]) return;
        const midx = parseInt(row["MapIdx"]); if (isNaN(midx) || midx >= 10) return;
        const sm = STATE.junctions[jid].signalMaps[midx];
        ["movA","movB","pedMovA","pedMovB","yellowA","yellowB","allredA","allredB","pedA","pedB","pedDelayA","pedDelayB","pedFlashA","pedFlashB","pedGreenA","pedGreenB"].forEach(k => {
            if (row[k] !== undefined) sm[k] = String(row[k]).split(';').map(Number);
        });
        if (row["mainMovements"]) sm.mainMovements = row["mainMovements"].split(';');
        sm.startTime = row["startTime"] || ""; sm.endTime = row["endTime"] || "";
    });
}

function processTodPlanCSV(csv) {
    const rows = parseCSV(csv);
    rows.forEach(row => {
        let jid = row["ID"] || row["id"]; if (!jid || !STATE.junctions[jid]) return;
        const d_plan = parseInt(row["Day_plan"]); if (isNaN(d_plan) || d_plan < 1 || d_plan > 10) return;
        const dIdx = d_plan - 1;
        STATE.junctions[jid].dayPlanMapIds[dIdx] = parseInt(row["SignalMap"]) || 0;
        for (let sIdx = 0; sIdx < 16; sIdx++) {
            const slot = row[`Time_plan${sIdx+1}`]; if (!slot) continue;
            const p = slot.split('|');
            if (p[0] === "-1") STATE.junctions[jid].schedules[dIdx][sIdx].h = -1;
            else if (p[0].includes(':')) { const [h, m] = p[0].split(':').map(Number); STATE.junctions[jid].schedules[dIdx][sIdx].h = h; STATE.junctions[jid].schedules[dIdx][sIdx].m = m; }
            if (p[1]) STATE.junctions[jid].schedules[dIdx][sIdx].cycle = parseInt(p[1]);
            if (p[2]) STATE.junctions[jid].dayPlans[dIdx][sIdx].offset = parseInt(p[2]);
            if (p[3]) STATE.junctions[jid].dayPlans[dIdx][sIdx].splitA = p[3].split(';').map(Number);
            if (p[4]) STATE.junctions[jid].dayPlans[dIdx][sIdx].splitB = p[4].split(';').map(Number);
            if (p[5]) STATE.junctions[jid].schedules[dIdx][sIdx].idx = parseInt(p[5]);
            else STATE.junctions[jid].schedules[dIdx][sIdx].idx = (parseInt(row["SignalMap"]) || 0) + 1;
        }

    });
}

function parseCSV(csv) {
    const lines = csv.trim().split(/\r?\n/); if (lines.length < 2) return [];
    const headers = lines[0].replace(/^\ufeff/, '').split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const res = [];
    for (let i = 1; i < lines.length; i++) {
        const row = {}, cols = [], line = lines[i]; let start = 0, inQ = false;
        for (let c = 0; c < line.length; c++) {
            if (line[c] === '"') inQ = !inQ;
            else if (line[c] === ',' && !inQ) { cols.push(line.substring(start, c).replace(/^"|"$/g,'').trim()); start = c + 1; }
        }
        cols.push(line.substring(start).replace(/^"|"$/g,'').trim());
        headers.forEach((h, idx) => { if (cols[idx] !== undefined) row[h] = cols[idx]; });
        res.push(row);
    }
    return res;
}

/** 📊 신호운영 엑셀(XLSX) 정밀 분석 로더 (Full UI & Logic) */
async function handleExcelSignalLoad(input) {
    const files = Array.from(input.files).slice(0, 50);
    if (files.length === 0) return;

    const infoEl = document.getElementById('xlsx-info-text');
    const progEl = document.getElementById('xlsx-progress-bar');
    const percEl = document.getElementById('xlsx-percent-text');
    const contEl = document.getElementById('xlsx-progress-container');
    const listEl = document.getElementById('xlsx-loaded-list');

    if (contEl) contEl.style.display = 'block';
    if (listEl) {
        listEl.style.display = 'block';
        listEl.innerHTML = '<div style="margin-bottom:5px; font-weight:bold; color:#2ecc71;">로드 목록 (최대 50개):</div>';
    }

    const updateProgress = (pct, msg) => {
        if (progEl) progEl.style.width = pct + '%';
        if (percEl) percEl.textContent = pct + '%';
        if (infoEl) infoEl.textContent = msg;
    };

    const addToList = (filename, status, errorMsg = "") => {
        if (!listEl) return;
        const color = (status === 'success') ? '#2ecc71' : '#e74c3c';
        const icon = (status === 'success') ? '✅' : '❌';
        const div = document.createElement('div');
        div.style.marginBottom = '2px';
        div.innerHTML = `<span style="color:${color}">${icon}</span> ${filename}${errorMsg ? `<span style="color:#e74c3c; font-size:10px;"> (${errorMsg})</span>` : ''}`;
        listEl.appendChild(div);
        listEl.scrollTop = listEl.scrollHeight;
    };

    if (typeof XLSX === 'undefined') {
        updateProgress(0, "라이브러리 로드 중...");
        await loadScript('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');
    }

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const stepPctBase = (i / files.length) * 100;
        const stepSize = 100 / files.length;

        try {
            updateProgress(Math.round(stepPctBase + (stepSize * 0.1)), `[${i+1}/${files.length}] ${file.name} 분석 중...`);
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const getVal = (r, c) => (sheetData[r-1] ? sheetData[r-1][c-1] : null);

            const jNo = parseInt(getVal(3, 37));
            if (isNaN(jNo)) throw new Error(`[C37] 교차로 번호 누락`);
            
            // L01 또는 L02 접두사를 포함해 매칭
            let junction = STATE.junctions[`L01-${jNo}0`] || STATE.junctions[`L02-${jNo}0`] || Object.values(STATE.junctions).find(j => String(j.seq) === String(jNo));
            if (!junction) throw new Error(`시스템에 교차로(No. ${jNo})가 없습니다.`);

            // [1] 이동류(Movement) ID 추출 (Row 5 & 12)
            const baseMovA = [], baseMovB = [];
            for (let c = 19; c <= 54; c += 5) {
                baseMovA.push(parseInt(getVal(5, c)) || 0);
                baseMovB.push(parseInt(getVal(12, c)) || 0);
            }

            // [2] 시그널맵 분석 엔진 (사용자 규칙 기반)
            const baseRowMapStart = 247;
            const processRingData = (startRow, baseMovs, eopSourceRow = null) => {
                const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0 }));
                const lsuHasPed = Array(8).fill(false);
                
                // 1. 전체 32스텝 로드
                const allSteps = [];
                for (let s = 0; s < 32; s++) {
                    const r = startRow + s;
                    // B링은 EOP('Y') 정보가 없을 수 있으므로 eopSourceRow(A링 행)를 참조
                    const eopRow = eopSourceRow ? eopSourceRow + s : r;
                    const info = {
                        min: parseInt(getVal(r, 53)) || 0,
                        eop: String(getVal(eopRow, 57) || "").toUpperCase() === 'Y',
                        sigsV: [], sigsP: []
                    };
                    for (let l = 0; l < 8; l++) {
                        // 차량신호(V)는 E열(5)부터 6칸씩, 보행신호(P)는 H열(8)부터 6칸씩
                        info.sigsV.push(parseInt(String(getVal(r, 5 + l * 6) || "0").trim()) || 0);
                        info.sigsP.push(parseInt(String(getVal(r, 8 + l * 6) || "0").trim()) || 0);
                    }
                    allSteps.push(info);
                }

                // 2. LSU별 보행맵 보유 여부 판정 (규칙: 보행 코드가 01(녹색) 또는 05(점멸)인 경우가 있는지 확인)
                for (let l = 0; l < 8; l++) {
                    for (let s = 0; s < 32; s++) {
                        const pCode = allSteps[s].sigsP[l];
                        if (pCode === 1 || pCode === 5) {
                            lsuHasPed[l] = true;
                            break;
                        }
                    }
                }

                // 3. 현시순서에 따라 매핑
                let currentStep = 0;
                for (let pIdx = 0; pIdx < 8; pIdx++) {
                    if (currentStep >= 32) break;
                    const stepsInPhase = [];
                    while (currentStep < 32) {
                        const st = allSteps[currentStep++];
                        stepsInPhase.push(st);
                        if (st.eop) break;
                    }

                    // 현시 종료(EOP) 스텝의 시간을 해당 현시의 황색(또는 클리어런스) 시간으로 지정
                    if (stepsInPhase.length > 0) {
                        const eopStep = stepsInPhase[stepsInPhase.length - 1];
                        if (eopStep.eop) {
                            phaseData[pIdx].yellow = eopStep.min;
                        }
                    }

                    // [A] 차량 이동류 번호는 5행/12행(baseMovs)에서 예외 없이 순서대로 매핑
                    const currentVId = baseMovs[pIdx] || 0;
                    phaseData[pIdx].vId = currentVId;

                    // [B] 보행 신호가 등화되는 LSU 탐색 (코드 1, 5, 10, 50 포함)
                    let pLSU = -1;
                    const checkPedActive = (l) => stepsInPhase.some(st => {
                        const p = st.sigsP[l];
                        return (p === 1 || p === 5 || p === 10 || p === 50);
                    });
                    
                    // 1~4번 LSU 우선 탐색, 없으면 5~8번 탐색
                    for (let l = 0; l < 4; l++) { if (checkPedActive(l)) { pLSU = l; break; } }
                    if (pLSU === -1) { for (let l = 4; l < 8; l++) { if (checkPedActive(l)) { pLSU = l; break; } } }

                    // [C] 데이터 기록 (보행 - 시간이 반드시 존재해야 ID 부여)
                    if (pLSU !== -1) {
                        let currentPhaseTime = 0;
                        let foundFirstGreen = false;

                        stepsInPhase.forEach(st => {
                            const pCode = st.sigsP[pLSU];
                            if (pCode === 1 || pCode === 10) {
                                if (!foundFirstGreen) {
                                    phaseData[pIdx].delay = currentPhaseTime;
                                    foundFirstGreen = true;
                                }
                                phaseData[pIdx].g += st.min;
                            } else if (pCode === 5 || pCode === 50) {
                                phaseData[pIdx].f += st.min;
                            }
                            currentPhaseTime += st.min;
                        });

                        // 시간이 실제로 계산된 경우에만 보행 ID 부여
                        if (phaseData[pIdx].g > 0 || phaseData[pIdx].f > 0) {
                            if (currentVId > 0 && currentVId % 2 === 0) {
                                phaseData[pIdx].pId = currentVId + 100;
                            } else {
                                // 차량 이동류가 직진(짝수)이 아니면, 해당 보행 신호가 있는 LSU의 고유 번호 할당
                                phaseData[pIdx].pId = pLSU + 101; 
                            }
                        } else {
                            phaseData[pIdx].pId = 0;
                        }
                    } else {
                        phaseData[pIdx].pId = 0;
                    }
                }
                return phaseData;
            };

            for (let m = 0; m < 6; m++) {
                const sm = junction.signalMaps[m];
                const startRowA = baseRowMapStart + (m * 67);
                const startRowB = startRowA + 32;

                const dataA = processRingData(startRowA, baseMovA);
                // B링 분석 시 A링의 EOP 행 위치를 함께 전달하여 동기화
                const dataB = processRingData(startRowB, baseMovB, startRowA);

                sm.movA = dataA.map(d => d.vId);
                sm.movB = dataB.map(d => d.vId);
                sm.pedMovA = dataA.map(d => d.pId);
                sm.pedMovB = dataB.map(d => d.pId);
                sm.yellowA = dataA.map(d => d.yellow);
                sm.yellowB = dataB.map(d => d.yellow);
                sm.pedGreenA = dataA.map(d => d.g);
                sm.pedGreenB = dataB.map(d => d.g);
                sm.pedFlashA = dataA.map(d => d.f);
                sm.pedFlashB = dataB.map(d => d.f);
                sm.pedDelayA = dataA.map(d => d.delay || 0);
                sm.pedDelayB = dataB.map(d => d.delay || 0);
                sm.pedA = dataA.map(d => d.g + d.f);
                sm.pedB = dataB.map(d => d.g + d.f);
            }

            // [3] 일계획 및 시간계획 분석 (기존 로직 유지)
            const dayPlansFound = {};
            const tpPlansDict = {};
            for (let r = 1; r < sheetData.length; r++) {
                for (let c = 1; c < 60; c++) {
                    const cellVal = String(getVal(r, c) || "");
                    if (cellVal.startsWith('일계획(')) {
                        const dMatch = cellVal.match(/\((\d+)\)/);
                        if (dMatch) {
                            const dNo = parseInt(dMatch[1]), slots = [];
                            for (let sr = r + 2; sr < r + 18; sr++) {
                                let vTime = getVal(sr, c + 2), tStr = "-1";
                                if (typeof vTime === 'number') {
                                    const tot = Math.round(vTime * 1440);
                                    tStr = `${String(Math.floor(tot/60)).padStart(2,'0')}:${String(tot%60).padStart(2,'0')}`;
                                } else tStr = String(vTime || "-1");
                                const cyc = parseInt(getVal(sr, c + 5)) || 0, tIdx = parseInt(getVal(sr, c + 8)) || 0;
                                if (cyc > 0) slots.push({ time: tStr, cycle: cyc, tpIdx: tIdx });
                            }
                            dayPlansFound[dNo] = slots;
                        }
                    }
                    if (cellVal.includes('시간계획(')) {
                        const tMatch = cellVal.match(/\((\d+)\)/);
                        if (tMatch) {
                            const tpIdx = parseInt(tMatch[1]), baseR = r + 2, tpPlans = [];
                            for (let idxS = 0; idxS < 16; idxS++) {
                                const isR = (idxS>=8), hO = isR?25:0, locI = isR?(idxS-8):idxS;
                                const rA = baseR+(locI*2), rB = rA+1;
                                const sAL = [], sBL = [];
                                const spC = c+9+hO, offC = c+6+hO, cycC = c+4+hO;
                                for (let sc=spC; sc<spC+16; sc+=2) { sAL.push(parseInt(getVal(rA, sc))||0); sBL.push(parseInt(getVal(rB, sc))||0); }
                                tpPlans.push({ cycle:parseInt(getVal(rA, cycC))||0, offset:parseInt(getVal(rA, offC))||0, splitA: sAL, splitB: sBL });
                            }
                            tpPlansDict[tpIdx] = tpPlans;
                        }
                    }
                }
            }

            for (let dK = 1; dK <= 5; dK++) {
                const daily = dayPlansFound[dK]; if (!daily) continue;
                const sysDayIndices = (dK === 1 ? [0, 5] : dK === 2 ? [1, 6] : dK === 3 ? [2, 7] : dK === 4 ? [3, 8] : dK === 5 ? [4, 9] : []);
                sysDayIndices.forEach(dIdx => {
                    junction.dayPlanMapIds[dIdx] = (dK - 1);
                    junction.schedules[dIdx] = Array.from({ length: 16 }, (_, sI) => {
                        const s = daily[sI]; if (!s) return { h: -1, m: 0, cycle: 100, idx: 1 };
                        const [h, m] = s.time.split(':').map(Number);
                        return { h, m, cycle: s.cycle, idx: s.tpIdx || 1 };
                    });
                    junction.dayPlans[dIdx] = Array.from({ length: 16 }, (_, sI) => {
                        const s = daily[sI];
                        const tPlans = tpPlansDict[dK] || tpPlansDict[1] || [];
                        const pl = (s && s.tpIdx > 0 && tPlans[s.tpIdx - 1]) ? tPlans[s.tpIdx - 1] : (tPlans[0] || null);
                        if (!pl) return { offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
                        return { offset: pl.offset, splitA: [...pl.splitA], splitB: [...pl.splitB] };
                    });
                });
            }
            successCount++;
            addToList(file.name, 'success');
        } catch (err) {
            console.error(file.name, err);
            addToList(file.name, 'fail', err.message);
        }
    }

    updateProgress(100, "분석 완료!");
    setTimeout(() => {
        alert(`분석 완료: 총 ${files.length}개 중 ${successCount}개 성공`);
        if (typeof renderRingTables === 'function') renderRingTables();
        if (typeof renderSummaryTable === 'function') renderSummaryTable();
        input.value = '';
    }, 500);
}

function processGeoJSON(json) {
    try {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        if (STATE.geoJsonLayer && window.map) window.map.removeLayer(STATE.geoJsonLayer);

        // 💎 은은하고 반투명한 유리(Glass-Sleek) 스타일
        STATE.geoJsonLayer = L.geoJSON(data, {
            style: (f) => {
                const props = f.properties;
                const gid = props.group || props.group_id || props.GroupID || props.link_id || props.id;
                const color = getGroupColor(gid);
                
                return {
                    color: color,
                    weight: 5.5,
                    opacity: 0.4, // 반투명 감각 강화
                    lineJoin: 'round',
                    lineCap: 'round',
                    fillColor: color,
                    fillOpacity: 0.05
                };
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const gid = props.group || props.group_id || props.GroupID || props.link_id || props.id;
                const color = getGroupColor(gid);

                layer.on({
                    mouseover: (e) => {
                        // 호버 시에도 과한 네온 효과 제거 (부드러운 포커스)

                        e.target.setStyle({ 
                            weight: 8, 
                            opacity: 0.8, 
                            color: '#2ecc71' 
                        });
                    },
                    mouseout: (e) => {
                        STATE.geoJsonLayer.resetStyle(e.target);
                    }
                });

                layer.bindTooltip(`
                    <div style="padding:10px; background:rgba(18,18,18,0.95); color:#fff; border-radius:12px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 20px rgba(0,0,0,0.5); font-size:12px;">
                        <span style="display:inline-block; width:10px; height:10px; background:${color}; border-radius:50%; margin-right:8px;"></span>
                        <b>Link:</b> <span style="color:#2ecc71;">${props.link_id || props.id || 'N/A'}</span><br>
                        <div style="margin-top:4px; opacity:0.7; font-size:10px;">🏢 Group ID: ${gid || 'Common'}</div>
                    </div>`, { sticky: true, className: "premium-tooltip" });
            }
        }).addTo(window.map);

        // [추가] 로딩 즉시 맵 상단 "연동" 버튼을 활성화 상태로 동기화
        const btn = document.getElementById('btn-road-network-toggle');
        if (btn) btn.classList.add('active');

        // [핵심 수정] 시각적 레이어만 만드는 것이 아니라, 편집 엔진(RoadManager)에도 데이터를 주입해야 함
        if (window.RoadManager) {
            console.log("[Data] Injecting GeoJSON into RoadManager for editing...");
            window.RoadManager.importJSON(data);
        }

    } catch (e) { console.error("Link GeoJSON Style Error:", e); }
}

function processBoundaryGeoJSON(json) {
    try {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        if (STATE.boundaryLayer && window.map) window.map.removeLayer(STATE.boundaryLayer);
        STATE.boundaryLayer = L.geoJSON(data, {
            style: { color: "#555", weight: 2, fillOpacity: 0.1, dashArray: '5,5' }
        }).addTo(window.map);
    } catch (e) { console.error("Boundary GeoJSON Error:", e); }
}


function createEmptySignalMap() {
    return { movA:Array(8).fill(0), movB:Array(8).fill(0), pedMovA:Array(8).fill(0), pedMovB:Array(8).fill(0), mainMovements:['A0','B0'], yellowA:[3,3,3,3,0,0,0,0], yellowB:[3,3,3,3,0,0,0,0], allredA:[2,2,2,2,0,0,0,0], allredB:[2,2,2,2,0,0,0,0], pedA:[0,15,0,15,0,0,0,0], pedB:[0,15,0,15,0,0,0,0], pedDelayA:[0,2,0,2,0,0,0,0], pedDelayB:[0,2,0,2,0,0,0,0], pedFlashA:Array(8).fill(0), pedFlashB:Array(8).fill(0), pedGreenA:Array(8).fill(0), pedGreenB:Array(8).fill(0), startTime:"", endTime:"" };
}

function parseExtraConfigs(j, row) {
    if (!row) return;
    const fStr = row["FlashCfg"];
    if (fStr && fStr.includes('|')) {
        const p = fStr.split('|'); j.flashEnable = p[0] === '1';
        j.flashTimes = (p[1]||"").split(';').map(s=>{ const b=s.split(','); return b.length>=2?{s:b[0],e:b[1]}:null; }).filter(t=>t);
        j.flashYellows = (p[2]||"").split(';').filter(v=>v).map(Number); j.flashReds = (p[3]||"").split(';').filter(v=>v).map(Number);
    }
}

/** 📊 특정 교차로 1개 분량의 CSV 행 데이터만 추출 */
function exportSingleJunctionCSV(jid) {
    const j = STATE.junctions[jid];
    if (!j) return null;

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
        const row = [j.id, idx, (sm.movA||[]).join(';'), (sm.movB||[]).join(';'), (sm.pedMovA||[]).join(';'), (sm.pedMovB||[]).join(';'), (sm.mainMovements||[]).join(';'), (sm.yellowA||[]).join(';'), (sm.yellowB||[]).join(';'), (sm.allredA||[]).join(';'), (sm.allredB||[]).join(';'), (sm.pedA||[]).join(';'), (sm.pedB||[]).join(';'), (sm.pedDelayA||[]).join(';'), (sm.pedDelayB||[]).join(';'), (sm.pedFlashA||[]).join(';'), (sm.pedFlashB||[]).join(';'), (sm.pedGreenA||[]).join(';'), (sm.pedGreenB||[]).join(';'), sm.startTime||"", sm.endTime||""];
        mapCsvLines += row.map(v => String(v)).join(",") + "\n";
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
            const pl = (pls && pls[s]) ? pls[s] : { offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
            const timeStr = sc.h === -1 ? "-1" : `${String(sc.h).padStart(2,'0')}:${String(sc.m).padStart(2,'0')}`;
            row.push(`${timeStr}|${sc.cycle || 100}|${pl.offset || 0}|${(pl.splitA||[]).join(';')}|${(pl.splitB||[]).join(';')}|${sc.idx || 1}`);
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

    showLoading(`교차로 [${jName}] DB 저장 중...`);
    try {
        const payload = exportSingleJunctionCSV(jid);
        if (!payload) {
            throw new Error("CSV 데이터 추출에 실패했습니다.");
        }

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
            processIntersectionCSV(mockCsv);
        }
        if (data.mapCsvLines) {
            const mockCsv = "ID,MapIdx,movA,movB,pedMovA,pedMovB,mainMovements,yellowA,yellowB,allredA,allredB,pedA,pedB,pedDelayA,pedDelayB,pedFlashA,pedFlashB,pedGreenA,pedGreenB,startTime,endTime\n" + data.mapCsvLines;
            processSignalMapCSV(mockCsv);
        }
        if (data.todCsvLines) {
            const mockCsv = "ID,Seq,SignalMap,GroupID,Day_plan,Time_plan1,Time_plan2,Time_plan3,Time_plan4,Time_plan5,Time_plan6,Time_plan7,Time_plan8,Time_plan9,Time_plan10,Time_plan11,Time_plan12,Time_plan13,Time_plan14,Time_plan15,Time_plan16\n" + data.todCsvLines;
            processTodPlanCSV(mockCsv);
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
    if (password !== '1234') {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }

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

        const response = await fetch(`/api/sim/tables/${typeToTable[type]}/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, records })
        });
        
        const result = await response.json();
        if (result.success) {
            alert(`✅ 총 ${result.count}건의 ${typeToTable[type]} 데이터가 백엔드에 성공적으로 동기화되었습니다.`);
        } else {
            throw new Error(result.error || '알 수 없는 오류');
        }
    } catch (err) {
        alert("백엔드 동기화 실패: " + err.message);
    }
}


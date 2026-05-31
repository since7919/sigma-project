/**
 * auto_load.js
 * ─────────────────────────────────────────────
 * 웹호스팅 환경에서 지정된 파일들을 자동으로 로드합니다.
 */

async function autoLoadFiles() {
    console.log("SIGMA - Starting Auto-load sequence (Verified Root Path)...");

    if (!STATE.loadedFiles) STATE.loadedFiles = {};

    // [Step 1] Core CSV 리스트 (순차 로딩 필요)
    const coreFiles = [
        { url: 'db_intersections.csv', type: 'inter', func: typeof processIntersectionCSV === 'function' ? processIntersectionCSV : null, label: '교차로' },
        { url: 'db_signal_maps.csv', type: 'maps', func: typeof processSignalMapCSV === 'function' ? processSignalMapCSV : null, label: '현시계획' },
        { url: 'db_tod_plans.csv', type: 'plans', func: typeof processTodPlanCSV === 'function' ? processTodPlanCSV : null, label: '운영계획' },
        { url: 'db_groups.csv', type: 'groups', func: typeof processGroupCSV === 'function' ? processGroupCSV : null, label: '그룹정보' },
        { url: 'db_stats.csv', type: 'stats', func: typeof _loadStatsCsv === 'function' ? _loadStatsCsv : null, label: '접근로통계' }
    ];

    for (const f of coreFiles) {
        try {
            if (!f.func) { console.warn(`[Auto-load] Handler for ${f.label} not found. Skipped.`); continue; }
            
            const res = await fetch(f.url);
            if (!res.ok) { console.warn(`[Auto-load] ${f.label} file not found (${f.url}).`); continue; }
            
            const buf = await res.arrayBuffer();
            const content = decodeBuffer(buf);
            if (content && content.length > 5) {
                // [정교화] 데이터 성격에 따른 인자 처리
                if (f.type === 'groups') {
                    if (typeof f.func === 'function') f.func(content, true); 
                } else {
                    if (typeof f.func === 'function') f.func(content);
                }
                STATE.loadedFiles[f.type] = f.url;
                console.log(`[Auto-load] ✅ ${f.label} Processed.`);
            }
        } catch (e) {
            console.error(`[Auto-load] Error loading ${f.url}:`, e);
        }
    }

    // [Step 2] 시각적 보조 파일들 로드
    await loadSupplementalFiles();
}

/** 지오메트리 및 연보 자동 로드 */
async function loadSupplementalFiles() {
    console.log("SIGMA - Loading Visual/Supplemental files...");
    
    // 지도가 로드될 때까지 최대 5초 대기
    let mapWaitCount = 0;
    while (!window.map && mapWaitCount < 10) {
        await new Promise(r => setTimeout(r, 500));
        mapWaitCount++;
    }

    const geoFiles = [
        { url: 'db_poly.geojson', type: 'poly', label: '행정경계' },
        { url: 'db_coordlink.geojson', type: 'links', label: '연동구간' }, 
        { url: 'db_yearbook.csv', type: 'yearbook', label: '신호운영연보' }
    ];

    for (const f of geoFiles) {
        try {
            const res = await fetch(f.url);
            if (!res.ok) continue;
            
            const buf = await res.arrayBuffer();
            const content = decodeBuffer(buf);
            
            if (f.type === 'poly') {
                if (typeof processBoundaryGeoJSON === 'function') {
                    processBoundaryGeoJSON(content);
                    STATE.loadedFiles.poly = f.url;
                }
            } else if (f.type === 'links') {
                if (typeof processGeoJSON === 'function') {
                    processGeoJSON(content);
                    STATE.loadedFiles.links = f.url;
                }
            } else if (f.type === 'yearbook') {
                if (typeof processCivilCSV === 'function') {
                    processCivilCSV(content);
                    STATE.loadedFiles.yearbook = f.url;
                }
            }
            console.log(`[Auto-load] ✅ ${f.label} Supplemental Loaded.`);
        } catch (e) { 
            console.error(`[Auto-load] Supplemental error (${f.url}):`, e); 
        }
    }
    
    // [최종] 모든 로딩이 끝난 후 UI 일괄 업데이트 (정직한 상태 표시)
    if (typeof refreshDBStats === 'function') refreshDBStats();
    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();

    // [신규] 데이터 로드 완료 후 교차로 목록 렌더링 및 사이드바 표시
    if (typeof renderJunctionList === 'function') {
        renderJunctionList();
        const sidebar = document.getElementById('left-search-sidebar');
        if (sidebar) {
            sidebar.classList.remove('hidden');
            console.log("[Auto-load] Search Sidebar Revealed with loaded data.");
        }
    }
}

/** 버퍼 디코딩 헬퍼 */
function decodeBuffer(arrayBuffer) {
    try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        return utf8Decoder.decode(arrayBuffer).replace(/^\ufeff/, '');
    } catch (e) {
        const krDecoder = new TextDecoder('euc-kr');
        return krDecoder.decode(arrayBuffer).replace(/^\ufeff/, '');
    }
}

window.addEventListener('SIGMA_READY', () => {
    autoLoadFiles();
});

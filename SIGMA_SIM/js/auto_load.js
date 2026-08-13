/**
 * auto_load.js
 * ─────────────────────────────────────────────
 * 웹호스팅 환경에서 지정된 파일들을 자동으로 로드합니다.
 */

async function autoLoadFiles() {
    console.log("SIGMA - Starting Auto-load sequence (Verified Regional Path)...");

    if (!STATE.loadedFiles) STATE.loadedFiles = {};

    const regionSelect = document.getElementById('api-region-select');
    const regionCode = regionSelect ? regionSelect.value : 'L01';

    // [Step 1] Core CSV 리스트 (지역별 동적 분할 파일 URL 맵핑)
    const coreFiles = [
        { url: `/api/sim/data?file=db_${regionCode}_intersections.csv`, type: 'inter', func: typeof processIntersectionCSV === 'function' ? processIntersectionCSV : null, label: '교차로' },
        { url: `/api/sim/data?file=db_${regionCode}_signal_maps.csv`, type: 'maps', func: typeof processSignalMapCSV === 'function' ? processSignalMapCSV : null, label: '현시계획' },
        { url: `/api/sim/data?file=db_${regionCode}_tod_plans.csv`, type: 'plans', func: typeof processTodPlanCSV === 'function' ? processTodPlanCSV : null, label: '운영계획' },
        { url: `/api/sim/data?file=db_${regionCode}_groups.csv`, type: 'groups', func: typeof processGroupCSV === 'function' ? processGroupCSV : null, label: '그룹정보' },
        { url: `/api/sim/data?file=db_${regionCode}_stats.csv`, type: 'stats', func: typeof _loadStatsCsv === 'function' ? _loadStatsCsv : null, label: '접근로통계' }
    ];

    // Start fetching all core files in parallel
    const fetchPromises = coreFiles.map(async (f) => {
        try {
            if (!f.func) return null;
            const res = await fetch(f.url);
            if (!res.ok) {
                console.warn(`[Auto-load] ${f.label} file not found (${f.url}).`);
                return null;
            }
            const buf = await res.arrayBuffer();
            const content = decodeBuffer(buf);
            return { f, content };
        } catch (e) {
            console.error(`[Auto-load] Error loading ${f.label} (${f.url}):`, e);
            return null;
        }
    });

    const results = await Promise.all(fetchPromises);

    // Process critical files in sequential order to preserve dependencies
    const criticalTypes = ['inter', 'maps', 'plans', 'groups'];
    for (const type of criticalTypes) {
        const res = results.find(r => r && r.f.type === type);
        if (res && res.content && res.content.length > 5) {
            const { f, content } = res;
            if (f.type === 'groups') {
                if (typeof f.func === 'function') f.func(content, true); 
            } else {
                if (typeof f.func === 'function') f.func(content);
            }
            STATE.loadedFiles[f.type] = f.url;
            console.log(`[Auto-load] ✅ ${f.label} Processed.`);
        }
    }

    // Process stats (non-critical, defer parsing to avoid blocking rendering thread)
    const statsRes = results.find(r => r && r.f.type === 'stats');
    if (statsRes && statsRes.content && statsRes.content.length > 5) {
        setTimeout(() => {
            try {
                const { f, content } = statsRes;
                f.func(content);
                STATE.loadedFiles[f.type] = f.url;
                console.log(`[Auto-load] ✅ ${f.label} Processed (Deferred).`);
            } catch (e) {
                console.error(`[Auto-load] Error processing stats:`, e);
            }
        }, 100);
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

    const regionSelect = document.getElementById('api-region-select');
    const regionCode = regionSelect ? regionSelect.value : 'L01';

    const geoFiles = [
        { url: `/api/sim/data?file=db_${regionCode}_poly.geojson`, type: 'poly', label: '행정경계' },
        { url: `/api/sim/data?file=db_${regionCode}_coordlink.geojson`, type: 'links', label: '연동구간' }, 
        { url: `/api/sim/data?file=db_${regionCode}_yearbook.csv`, type: 'yearbook', label: '신호운영연보' }
    ];

    // Start fetching all supplemental files in parallel
    const fetchPromises = geoFiles.map(async (f) => {
        try {
            const res = await fetch(f.url);
            if (!res.ok) return null;
            const buf = await res.arrayBuffer();
            const content = decodeBuffer(buf);
            return { f, content };
        } catch (e) {
            console.error(`[Auto-load] Supplemental fetch error (${f.url}):`, e);
            return null;
        }
    });

    const results = await Promise.all(fetchPromises);

    for (const result of results) {
        if (!result) continue;
        const { f, content } = result;
        try {
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
            console.error(`[Auto-load] Supplemental error processing (${f.url}):`, e); 
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

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

    // Helper function to load a single file
    async function fetchAndProcess(url, type, processFunc, label, isGroup = false) {
        try {
            if (!processFunc) return null;
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`[Auto-load] ${label} file not found (${url}).`);
                return null;
            }
            const buf = await res.arrayBuffer();
            const content = decodeBuffer(buf);
            
            if (content && content.length > 5) {
                if (isGroup) {
                    processFunc(content, true);
                } else {
                    processFunc(content);
                }
                STATE.loadedFiles[type] = url;
                console.log(`[Auto-load] ✅ ${label} Processed.`);
            }
        } catch (e) {
            console.error(`[Auto-load] Error loading ${label} (${url}):`, e);
        }
    }

    // [Step 1] 최우선 순위: 교차로마스터, 신호맵데이터, 운영계획 (병렬 로딩)
    const priority1 = [
        fetchAndProcess(`/api/sim/data?file=db_${regionCode}_intersections.csv`, 'inter', typeof processIntersectionCSV === 'function' ? processIntersectionCSV : null, '교차로마스터'),
        fetchAndProcess(`/api/sim/data?file=db_${regionCode}_signal_maps.csv`, 'maps', typeof processSignalMapCSV === 'function' ? processSignalMapCSV : null, '신호맵데이터'),
        fetchAndProcess(`/api/sim/data?file=db_${regionCode}_tod_plans.csv`, 'plans', typeof processTodPlanCSV === 'function' ? processTodPlanCSV : null, '운영계획')
    ];
    await Promise.all(priority1);

    // [Step 2] 그 다음: 그룹정보 마스터 (완료 후 교차로 목록 렌더링)
    await fetchAndProcess(`/api/sim/data?file=db_${regionCode}_groups.csv`, 'groups', typeof processGroupCSV === 'function' ? processGroupCSV : null, '그룹정보 마스터', true);
    
    // 그룹정보까지 로딩 완료 시 교차로 목록 렌더링 및 UI 갱신
    if (typeof refreshDBStats === 'function') refreshDBStats();
    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
    
    if (typeof renderJunctionList === 'function') {
        renderJunctionList();
        const sidebar = document.getElementById('left-search-sidebar');
        if (sidebar) {
            sidebar.classList.remove('hidden');
            console.log("[Auto-load] Search Sidebar Revealed (Priority 1 & Group finished).");
        }
    }

    // [Step 3] 나머지 백그라운드 우선순위: 연동구간, 행정경계, 접근로 통계, 신호운영연보
    // 지도가 로드될 때까지 최대 5초 대기 (행정경계나 연동구간은 지도 객체가 필요할 수 있음)
    let mapWaitCount = 0;
    while (!window.map && mapWaitCount < 10) {
        await new Promise(r => setTimeout(r, 500));
        mapWaitCount++;
    }

    // 백그라운드 병렬 로딩
    const priority3 = [
        fetchAndProcess(`/api/sim/data?file=db_${regionCode}_coordlink.geojson`, 'links', typeof processGeoJSON === 'function' ? processGeoJSON : null, '연동구간'),
        fetchAndProcess(`/api/sim/data?file=db_${regionCode}_poly.geojson`, 'poly', typeof processBoundaryGeoJSON === 'function' ? processBoundaryGeoJSON : null, '행정경계'),
        fetchAndProcess(`/api/sim/data?file=db_${regionCode}_stats.csv`, 'stats', typeof _loadStatsCsv === 'function' ? _loadStatsCsv : null, '접근로 통계'),
        fetchAndProcess(`/api/sim/data?file=db_${regionCode}_yearbook.csv`, 'yearbook', typeof processCivilCSV === 'function' ? processCivilCSV : null, '신호운영연보')
    ];
    
    await Promise.all(priority3);
    
    // 전체 로딩 후 다시 한 번 UI 갱신
    if (typeof refreshDBStats === 'function') refreshDBStats();
    console.log("SIGMA - All Auto-load sequence completed.");
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

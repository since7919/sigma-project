/**
 * SIGMA - Intersection Search Module
 * Handles junction listing, filtering, and map navigation.
 */

function toggleLeftSidebar() {
    const sidebar = document.getElementById('left-search-sidebar');
    if (!sidebar) return;

    const isHidden = sidebar.classList.toggle('hidden');
    document.body.classList.toggle('left-sidebar-open', !isHidden);
    
    if (!isHidden) {
        renderJunctionList();
        // Focus search input when opening
        const searchInput = document.getElementById('j-sidebar-search');
        if (searchInput) searchInput.focus();
    }
}

/**
 * 지역 필터 함수 (공통)
 */
const REGION_MAP = {
    'L01': '서울특별시',
    'L02': '인천광역시',
    '155': '대구광역시',
    '131': '대전광역시',
    '142': '울산광역시',
    '161': '부산광역시'
};

let _openAccordions = { 'L01': true };

window.toggleAccordion = function(regionCode) {
    _openAccordions[regionCode] = !_openAccordions[regionCode];
    renderJunctionList();
};

/**
 * Helper to determine region of a junction based on ID if region is missing
 */
function getJunctionRegion(j) {
    if (j.region) return j.region;
    const jid = String(j.id);
    if (jid.startsWith('L01-') || jid.startsWith('krd-') || jid.startsWith('110-')) return 'L01';
    if (jid.startsWith('L02-') || jid === '1001') return 'L02';
    for (const code of Object.keys(REGION_MAP)) {
        if (jid.startsWith(`${code}-`)) return code;
    }
    return 'UNKNOWN';
}

/**
 * Renders the full list of junctions from STATE.junctions grouped by region (Accordion)
 */

// --- 가상 스크롤 전역 변수 ---
let _virtualListItems = [];
let _virtualListTotalHeight = 0;
let _scrollContainer = null;
let _scrollContent = null;
let _isVirtualScrollInitialized = false;

const HEADER_HEIGHT = 43;
const ITEM_HEIGHT = 32;

function buildVirtualListData() {
    const s = (typeof STATE !== 'undefined') ? STATE : window.STATE;
    const junctions = (s && s.junctions) ? s.junctions : {};
    const searchInput = document.getElementById('j-sidebar-search');
    const query = (searchInput ? searchInput.value.toLowerCase().trim() : '');
    
    _virtualListItems = [];
    _virtualListTotalHeight = 0;

    // Cache pre-sorted junctions list
    const jKeys = Object.keys(junctions);
    if (!s.sortedJunctions || s.sortedJunctions.length !== jKeys.length) {
        s.sortedJunctions = Object.values(junctions).sort((a, b) => {
            const rA = getJunctionRegion(a);
            const rB = getJunctionRegion(b);
            const rNameA = REGION_MAP[rA] || rA;
            const rNameB = REGION_MAP[rB] || rB;
            const regionCompare = rNameA.localeCompare(rNameB, 'ko');
            if (regionCompare !== 0) return regionCompare;
            return (a.name || '').localeCompare(b.name || '', 'ko');
        });
    }
    
    let filtered = s.sortedJunctions || [];
    let hasSearchResult = true;
    
    if (query) {
        filtered = filtered.filter(j => (j.name||'').toLowerCase().includes(query) || String(j.id).toLowerCase().includes(query));
        if (filtered.length === 0) hasSearchResult = false;
    }

    if (filtered.length === 0) {
        return hasSearchResult;
    }

    const grouped = {};
    const regionCodes = [];
    
    filtered.forEach(j => {
        const rCode = getJunctionRegion(j);
        if (!grouped[rCode]) {
            grouped[rCode] = [];
            regionCodes.push(rCode);
        }
        grouped[rCode].push(j);
    });

    let currentTop = 0;
    
    regionCodes.forEach(rCode => {
        const rName = REGION_MAP[rCode] || rCode;
        const items = grouped[rCode]; // already sorted!
        const isOpen = query ? true : !!_openAccordions[rCode];
        
        _virtualListItems.push({
            type: 'header',
            rCode: rCode,
            rName: rName,
            count: items.length,
            isOpen: isOpen,
            top: currentTop,
            height: HEADER_HEIGHT
        });
        currentTop += HEADER_HEIGHT;
        
        if (isOpen) {
            items.forEach(j => {
                _virtualListItems.push({
                    type: 'item',
                    j: j,
                    top: currentTop,
                    height: ITEM_HEIGHT
                });
                currentTop += ITEM_HEIGHT;
            });
        }
    });
    
    _virtualListTotalHeight = currentTop;
    return hasSearchResult;
}

function updateVirtualListDOM() {
    if (!_scrollContainer || !_scrollContent) return;
    
    if (_virtualListItems.length === 0) {
        _scrollContent.innerHTML = '';
        _scrollContent.style.height = 'auto';
        return;
    }

    _scrollContent.style.height = _virtualListTotalHeight + 'px';
    
    const scrollTop = _scrollContainer.scrollTop;
    const clientHeight = _scrollContainer.clientHeight || 800;
    
    let startIndex = 0;
    let endIndex = _virtualListItems.length - 1;
    
    let low = 0, high = _virtualListItems.length - 1;
    while(low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (_virtualListItems[mid].top + _virtualListItems[mid].height < scrollTop - 200) {
            low = mid + 1;
        } else {
            startIndex = mid;
            high = mid - 1;
        }
    }
    
    low = startIndex; high = _virtualListItems.length - 1;
    while(low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (_virtualListItems[mid].top > scrollTop + clientHeight + 200) {
            endIndex = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }
    
    const s = (typeof STATE !== 'undefined') ? STATE : window.STATE;
    const activeJid = String(s.activeJid || "");
    
    let html = '';
    for (let i = startIndex; i <= endIndex; i++) {
        const item = _virtualListItems[i];
        if (item.type === 'header') {
            html += `
            <div class="acc-group" style="position:absolute; top:${item.top}px; left:0; right:0; height:${item.height}px; margin:0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div class="acc-header" onclick="toggleAccordion('${item.rCode}')" style="height:100%; box-sizing:border-box; margin:0;">
                    <span class="acc-icon" style="width:20px;">${item.isOpen ? '▼' : '▶'}</span>
                    ${item.rName} <span class="acc-count">(${item.count})</span>
                </div>
            </div>`;
        } else {
            const j = item.j;
            const isActive = activeJid === String(j.id);
            html += `
            <div class="tree-item j-list-item ${isActive ? 'selected' : ''}" onclick="flyToIntersection('${j.id}')" data-id="${j.id}" style="position:absolute; top:${item.top}px; left:0; right:0; height:${item.height}px; box-sizing:border-box; margin:0;">
                <div class="status-dot" style="background: ${isActive ? '#38bdf8' : '#64748b'}; width:8px; height:8px; border-radius:50%; margin-right:8px; flex-shrink:0;"></div>
                <span style="color:#94a3b8; font-size:10px; margin-right:4px; flex-shrink:0;">[${j.id}]</span> 
                <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${j.name || '-'}</span>
            </div>`;
        }
    }
    
    _scrollContent.innerHTML = html;
}

function renderJunctionList() {
    const listEl = document.getElementById('accordion-container');
    if (!listEl) return;

    const s = (typeof STATE !== 'undefined') ? STATE : window.STATE;
    const junctions = (s && s.junctions) ? s.junctions : {};
    
    if (Object.keys(junctions).length === 0) {
        listEl.innerHTML = `
            <div style="padding:40px 20px; color:#666; font-size:12.5px; text-align:center;">
                <div style="margin-bottom:10px; font-size:24px; opacity:0.5;">🚫</div>
                표시할 교차로 데이터가 없습니다.<br>
                <div style="font-size:11px; color:#888; margin-top:8px;">(CSV 파일 로드 후 확인하세요)</div>
            </div>`;
        return;
    }

    if (!_isVirtualScrollInitialized) {
        _scrollContainer = listEl;
        _scrollContainer.style.position = 'relative';
        _scrollContainer.innerHTML = '<div id="virtual-scroll-content" style="position:relative; width:100%;"></div>';
        _scrollContent = document.getElementById('virtual-scroll-content');
        
        _scrollContainer.addEventListener('scroll', () => {
            window.requestAnimationFrame(updateVirtualListDOM);
        });
        _isVirtualScrollInitialized = true;
    }
    
    const hasResult = buildVirtualListData();
    updateVirtualListDOM();
    
    handleNoSearchResult(!hasResult);
}

function filterJunctionList(event) {
    renderJunctionList(); // 가상스크롤에서는 렌더링 자체가 필터링을 포함하며 즉시(Zero-lag) 반영됩니다.
    
    const searchInput = document.getElementById('j-sidebar-search');
    const query = (searchInput ? searchInput.value.toLowerCase().trim() : '');
    if (event && event.key === 'Enter' && query !== '') {
        const hasResult = _virtualListItems.length > 0;
        if (!hasResult) searchAndMoveToLocation(query);
    }
}

function handleNoSearchResult(show) {
    const query = (document.getElementById('j-sidebar-search')?.value || '').trim();
    let noResultEl = document.getElementById('j-sidebar-no-result');
    
    if (show && query !== '') {
        if (!noResultEl) {
            noResultEl = document.createElement('div');
            noResultEl.id = 'j-sidebar-no-result';
            noResultEl.style.padding = '15px';
            noResultEl.style.textAlign = 'center';
            noResultEl.style.color = '#bbb';
            noResultEl.style.fontSize = '12px';
            document.getElementById('j-sidebar-list').appendChild(noResultEl);
        }
        noResultEl.innerHTML = `
            <div style="margin-bottom:10px;">교차로 검색 결과가 없습니다.</div>
            <button class="btn-neon" onclick="searchAndMoveToLocation('${query}')" style="width:100%; font-size:11px;">
                🌍 '${query}' 장소 검색 (Enter)
            </button>
        `;
        noResultEl.style.display = 'block';
    } else {
        if (noResultEl) noResultEl.style.display = 'none';
    }
}

let _placeSearchMarker = null;

/**
 * Nominatim API를 활용한 장소 검색 및 지도 이동 함수
 * @param {string} location - 사용자가 입력한 장소명 (예: "종로구청")
 */
async function searchAndMoveToLocation(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1&addressdetails=1`;
    const searchBtn = document.querySelector('#j-sidebar-no-result button');
    if (searchBtn) searchBtn.innerHTML = "⏳ 검색 중...";

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SigmaDashboardApp/1.0' // Nominatim 정책상 User-Agent 필수
            }
        });
        const data = await response.json();

        if (data && data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const targetMap = (typeof map !== 'undefined') ? map : window.map;

            if (targetMap) {
                // 2. 대시보드 지도 이동
                targetMap.flyTo([parseFloat(lat), parseFloat(lon)], 16, {
                    animate: true,
                    duration: 1.5
                });

                // 기존 마커 제거
                if (_placeSearchMarker) {
                    targetMap.removeLayer(_placeSearchMarker);
                }

                // 3. 검색 지점에 마커 표시 및 팝업
                _placeSearchMarker = L.marker([lat, lon]).addTo(targetMap)
                    .bindPopup(`<b>${location}</b><br><span style="font-size:10px;">${display_name}</span>`)
                    .openPopup();
                
                console.log(`이동 완료: ${display_name}`);
            }
            if (searchBtn) searchBtn.innerHTML = "✅ 장소 이동 완료";
        } else {
            alert(`'${location}' 장소를 찾을 수 없습니다.`);
            if (searchBtn) searchBtn.innerHTML = "❌ 장소를 찾을 수 없습니다.";
        }
    } catch (error) {
        console.error("Nominatim API 호출 중 오류 발생:", error);
        alert("장소 검색 API 호출 중 오류가 발생했습니다.");
        if (searchBtn) searchBtn.innerHTML = "❌ 검색 오류 발생";
    }
}

/**
 * Navigates the map to the selected junction and selects it in the UI
 * @param {string} jid Junction ID
 */
function flyToIntersection(jid) {
    const s = (typeof STATE !== 'undefined') ? STATE : window.STATE;
    if (!s || !s.junctions || !s.junctions[jid]) return;
    
    const j = s.junctions[jid];
    
    // Use global map object
    const targetMap = (typeof map !== 'undefined') ? map : window.map;
    
    // [사용자 요청] 화면 흔들림 애니메이션 삭제 (빠른 이동)
    if (targetMap) {
        try {
            targetMap.setView([j.lat, j.lng], 17, { animate: false });
        } catch (e) {
            console.warn('SIGMA - Map setView failed (possibly hidden):', e);
        }
    } else {
        console.warn('SIGMA - Map object not found. Skipping map view update.');
    }

    // 지도 존재/오류 여부와 무관하게 선택 로직은 무조건 실행 (Phase/Split 등 타 탭 지원)
    const selFunc = (typeof selectJunction === 'function') ? selectJunction : window.selectJunction;
    if (typeof selFunc === 'function') {
        selFunc(jid);
    }

    // On mobile/small screens, close sidebar after selection
    if (window.innerWidth < 768) {
        if (typeof toggleLeftSidebar === 'function') toggleLeftSidebar();
    }
}

/**
 * [고도화] Phase/Split 탭 전용 실시간 검색 핸들러
 * @param {string} query 검색어
 * @param {boolean} isForceSelect 즉시 선택 여부 (조회 버튼 클릭 시)
 */
function handlePhaseSearch(query, isForceSelect = false) {
    const resultsEl = document.getElementById('phase-search-results');
    if (!resultsEl) return;

    query = query.trim().toLowerCase();
    
    // 검색어가 없으면 드롭다운 숨김
    if (!query) {
        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = "";
        return;
    }

    const s = (typeof STATE !== 'undefined') ? STATE : window.STATE;
    if (!s || !s.junctions) return;

    const regionSelect = document.getElementById('api-region-select');
    const regionCode = regionSelect ? regionSelect.value : '110';

    // 통합 검색 필터링 (ID, 명칭, 연등번호 포함, 그리고 지역 선택 반영)
    const junctions = Object.values(s.junctions);
    const filtered = junctions.filter(j => {
        const idStr = String(j.id).toLowerCase();
        
        // 지역 필터
        let matchRegion = isMatchingRegion(j);
        if (!matchRegion) return false;

        const nameStr = (j.name || "").toLowerCase();
        const seqStr = String(j.seq || "").toLowerCase();
        const officeStr = (j.office || "").toLowerCase();
        return idStr.includes(query) || nameStr.includes(query) || seqStr.includes(query) || officeStr.includes(query);
    });

    if (isForceSelect && filtered.length > 0) {
        // '조회' 버튼 클릭 시 첫 번째 결과로 즉시 이동
        flyToIntersection(filtered[0].id);
        resultsEl.classList.add('hidden');
        document.getElementById('inp-search-phase-jid').value = filtered[0].name || filtered[0].id;
        return;
    }

    if (filtered.length === 0) {
        resultsEl.innerHTML = `<div style="padding:15px; color:#666; font-size:11px; text-align:center;">검색 결과가 없습니다.</div>`;
    } else {
        resultsEl.innerHTML = filtered.slice(0, 50).map(j => `
            <div class="j-list-item" onclick="selectPhaseSearchResult('${j.id}', '${j.name}')">
                <div class="j-item-id">ID: ${j.id}</div>
                <div class="j-item-name">${j.name || '-'}</div>
                <div class="j-item-info">${j.office || ''} | 연등: ${j.seq || '없음'}</div>
            </div>
        `).join('');
    }

    resultsEl.classList.remove('hidden');
}

/** 검색 결과 항목 클릭 시 처리 */
function selectPhaseSearchResult(jid, name) {
    flyToIntersection(jid);
    const resultsEl = document.getElementById('phase-search-results');
    const inputEl = document.getElementById('inp-search-phase-jid');
    
    if (resultsEl) resultsEl.classList.add('hidden');
    if (inputEl) inputEl.value = name || jid;
}

// 클릭 이벤트 리스너 추가 (바깥 클릭 시 드롭다운 닫기)
document.addEventListener('click', function(e) {
    const resultsEl = document.getElementById('phase-search-results');
    const inputEl = document.getElementById('inp-search-phase-jid');
    if (resultsEl && inputEl && !resultsEl.contains(e.target) && e.target !== inputEl) {
        resultsEl.classList.add('hidden');
    }
});

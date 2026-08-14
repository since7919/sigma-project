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
function renderJunctionList() {
    const listEl = document.getElementById('accordion-container');
    if (!listEl) return;

    // 전역 STATE 객체 확인
    const s = (typeof STATE !== 'undefined') ? STATE : window.STATE;
    const junctions = (s && s.junctions) ? s.junctions : {};
    const junctionsCount = Object.keys(junctions).length;
    
    if (junctionsCount === 0) {
        listEl.innerHTML = `
            <div style="padding:40px 20px; color:#666; font-size:12.5px; text-align:center;">
                <div style="margin-bottom:10px; font-size:24px; opacity:0.5;">🚫</div>
                표시할 교차로 데이터가 없습니다.<br>
                <div style="font-size:11px; color:#888; margin-top:8px;">(CSV 파일 로드 후 확인하세요)</div>
            </div>`;
        _junctionListItems = null;
        return;
    }

    // 그룹화
    const grouped = {};
    Object.values(junctions).forEach(j => {
        const rCode = getJunctionRegion(j);
        if (!grouped[rCode]) grouped[rCode] = [];
        grouped[rCode].push(j);
    });

    const activeJid = String(s.activeJid || "");

    let html = '';
    
    // Sort region codes by name
    const regionCodes = Object.keys(grouped).sort((a,b) => (REGION_MAP[a]||a).localeCompare(REGION_MAP[b]||b, 'ko'));
    
    regionCodes.forEach(rCode => {
        const isOpen = _openAccordions[rCode];
        const rName = REGION_MAP[rCode] || rCode;
        const items = grouped[rCode].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
        
        html += `
        <div class="acc-group" data-region="${rCode}">
            <div class="acc-header" onclick="toggleAccordion('${rCode}')">
                <span class="acc-icon">${isOpen ? '▼' : '▶'}</span>
                ${rName} <span class="acc-count">(${items.length})</span>
            </div>
            ${isOpen ? `
            <div class="acc-body">
                ${items.map(j => {
                    const isActive = activeJid === String(j.id);
                    return `
                    <div class="tree-item j-list-item ${isActive ? 'selected' : ''}" onclick="flyToIntersection('${j.id}')" data-id="${j.id}">
                        <div class="status-dot" style="background: ${isActive ? '#38bdf8' : '#64748b'}; width:8px; height:8px; border-radius:50%; margin-right:8px;"></div>
                        <span style="color:#94a3b8; font-size:10px; margin-right:4px;">[${j.id}]</span> 
                        <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${j.name || '-'}</span>
                    </div>
                    `;
                }).join('')}
            </div>
            ` : ''}
        </div>
        `;
    });

    listEl.innerHTML = html;

    // [Optimize] Cache items for filtering
    _junctionListItems = listEl.querySelectorAll('.j-list-item');

    // 검색어가 남아있으면 다시 필터링
    const searchInput = document.getElementById('j-sidebar-search');
    if (searchInput && searchInput.value) {
        filterJunctionList();
    }
}

/**
 * Filters the visible junction items based on search query
 */
function filterJunctionList(event) {
    const searchInput = document.getElementById('j-sidebar-search');
    if (!searchInput) return;

    const query = searchInput.value.toLowerCase().trim();
    
    // Use cached items if available
    const items = document.querySelectorAll('.j-list-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });

    // 검색 결과가 없는 경우 장소 검색 UI 표시
    let noResultEl = document.getElementById('j-sidebar-no-result');
    if (visibleCount === 0 && query !== '') {
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
        
        // Enter 키 누르면 장소 검색 바로 실행
        if (event && event.key === 'Enter') {
            searchAndMoveToLocation(query);
        }
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

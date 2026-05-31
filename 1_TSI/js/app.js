window.fetchData = async function(targetUrl) {
    if (!API_CONFIG.useProxy) {
        return await fetch(targetUrl);
    }
    // 닷홈 WAF 우회: HTTP/HTTPS 문자열을 치환하여 GET 방식(safeurl)으로 우회
    const safeUrl = targetUrl.replace('http://', '_HTTP_').replace('https://', '_HTTPS_');
    return await fetch('/api_bridge.php?safeurl=' + encodeURIComponent(safeUrl));
};

const REGIONS = [
    { code: 'L01', name: '서울시' }, { code: 'L02', name: '인천시' }, { code: 'L03', name: '부천시' },
    { code: 'L04', name: '광명시' }, { code: 'L05', name: '안양시' }, { code: 'L06', name: '과천시' },
    { code: 'L07', name: '안산시' }, { code: 'L08', name: '용인시' }, { code: 'L09', name: '성남시' },
    { code: 'L10', name: '고양시' }, { code: 'L11', name: '시흥시' }, { code: 'L12', name: '파주시' },
    { code: 'L13', name: '양주시' }, { code: 'L14', name: '의정부시' }, { code: 'L15', name: '김포시' },
    { code: 'L16', name: '의왕시' }, { code: 'L17', name: '군포시' }, { code: 'L18', name: '남양주시' },
    { code: 'L19', name: '수원시' }, { code: 'L20', name: '경기도광주시' }, { code: 'L21', name: '구리시' },
    { code: 'L22', name: '하남시' }, { code: 'L23', name: '부산시' }, { code: 'L24', name: '양산시' },
    { code: 'L25', name: '창원시' }, { code: 'L26', name: '김해시' }, { code: 'L28', name: '거제시' },
    { code: 'L29', name: '대구시' }, { code: 'L30', name: '대전시' }, { code: 'L31', name: '광주광역시' },
    { code: 'L37', name: '포항시' }
];

const API_CONFIG = {
    baseUrl: 'http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo',
    planWdUrl: 'http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRWDInfo',
    cropUrl: 'http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCROPInfo',
    statusUrl: 'http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRSTInfo',
    sigMapUrl: 'http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo',
    serviceKey: 'kgA1yoaXkd7iVJkKR9Ze5iA7zZ3WWI1UJHn1SQk9QLI',
    useProxy: true,
    proxyUrl: 'http://localhost:3001/proxy?url='
};

let currentCropData = null; 
let currentSigMapData = { ringA: [], ringB: [] }; 
let isApiConnected = false; 

function updateApiStatus(apiType, isConnected, message = null, responseTimeMs = null) {
    if (apiType === 'utic') {
        isApiConnected = isConnected;
    }
    
    const dot = document.getElementById(apiType + '-status-dot');
    const text = document.getElementById(apiType + '-status-text');
    const timeEl = document.getElementById(apiType + '-status-time');
    
    if (dot && text) {
        if (isConnected) {
            dot.className = 'status-dot online';
            text.textContent = message || 'Connected';
            text.style.color = '#10b981';
        } else {
            dot.className = 'status-dot offline';
            text.textContent = message || 'Disconnected';
            text.style.color = '#ef4444';
        }
    }
    
    if (timeEl) {
        if (responseTimeMs !== null) {
            timeEl.textContent = `${Math.round(responseTimeMs)}ms`;
        } else {
            timeEl.textContent = '-ms';
        }
    }
}

async function checkUticConnection() {
    try {
        const testUrl = `${API_CONFIG.baseUrl}?serviceKey=${API_CONFIG.serviceKey}&type=json&srchCTId=L02&pageNo=1&numOfRows=1`;
        const startTime = performance.now();
        const response = await window.fetchData(testUrl);
        const endTime = performance.now();
        if (response.ok) {
            updateApiStatus('utic', true, 'Connected', endTime - startTime);
        } else {
            updateApiStatus('utic', false, 'Disconnected');
        }
    } catch (e) {
        updateApiStatus('utic', false, 'Disconnected');
    }
}

let currentSignalTimer = null;
let simulatedCycle = 0;

let map;
let markers = [];
let currentRegionCode = '';

async function loadSeoulMapData() {
    const today = new Date().toISOString().split('T')[0];
    const cachedDate = localStorage.getItem('sigma_map_date_v2');
    const cachedData = localStorage.getItem('sigma_map_data_v2');
    
    if (cachedDate === today && cachedData) {
        try {
            window.SEOUL_V2X_DATA = JSON.parse(cachedData);
            
            // 트리 렌더링을 위한 SEOUL_CROSSROAD_DATA 호환 구조 생성
            const mappedData = window.SEOUL_V2X_DATA.map(item => {
                let la = parseFloat(item.mapCtptIntLat);
                let lo = parseFloat(item.mapCtptIntLot);
                
                if (la && la < 10) la = la * 10;
                if (lo && lo < 100) lo = lo * 10;
                
                return {
                    itstId: item.itstId,
                    intr_nm: item.itstNm,
                    la: la,
                    lo: lo,
                    gu_cd: '000'
                };
            });
            window.SEOUL_CROSSROAD_DATA = { DATA: mappedData };
            
            console.log('Loaded Map Data from Cache');
            return;
        } catch (e) {
            console.warn('Failed to parse cached map data', e);
        }
    }
    
    try {
        console.log('Fetching Map Data from CSV...');
        // CORS 및 경로 한글 깨짐 방지를 위해 영문 폴더/파일명으로 변경
        const res = await fetch('data/seoul_map.csv?t=' + Date.now());
        if (!res.ok) throw new Error('Failed to fetch CSV');
        
        const csvText = await res.text();
        const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let data = [];
        let headerParsed = false;
        let headers = [];
        for (let i = 0; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (!headerParsed) {
                // BOM 제거
                headers = cols.map(h => h.replace(/^\uFEFF/, ''));
                headerParsed = true;
                continue;
            }
            
            let item = {};
            for (let j = 0; j < headers.length; j++) {
                item[headers[j]] = cols[j];
            }
            data.push(item);
        }
        
        window.SEOUL_V2X_DATA = data;
        
        // 트리 렌더링을 위한 SEOUL_CROSSROAD_DATA 호환 구조 생성
        const mappedData = data.map(item => {
            let la = parseFloat(item.mapCtptIntLat);
            let lo = parseFloat(item.mapCtptIntLot);
            
            // 좌표 오타(소수점 밀림) 보정 로직
            if (la && la < 10) la = la * 10;
            if (lo && lo < 100) lo = lo * 10;

            return {
                itstId: item.itstId,
                intr_nm: item.itstNm,
                la: la,
                lo: lo,
                gu_cd: '000'
            };
        });
        window.SEOUL_CROSSROAD_DATA = { DATA: mappedData };
        
        localStorage.setItem('sigma_map_data_v2', JSON.stringify(data));
        localStorage.setItem('sigma_map_date_v2', today);
        console.log(`Saved ${data.length} map items to localStorage.`);
        
    } catch (err) {
        console.error('Error loading map data:', err);
        // 만약 fetch 실패라면 (CORS, 파일 없음 등)
        alert('맵 데이터(CSV)를 불러오지 못했습니다.\n경로를 확인하거나 로컬 파일 직접 실행(CORS) 제한인지 확인하세요.');
        window.SEOUL_V2X_DATA = [];
        window.SEOUL_CROSSROAD_DATA = { DATA: [] };
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    await loadSeoulMapData();
    initMap();
    
    renderTree(); 
    
    // 서울Tdata 개방데이터 로드 및 렌더링
    if (typeof window.SEOUL_CROSSROAD_DATA !== 'undefined') {
        renderSeoulTree();
    } else {
        console.warn('서울시 교차로 관련 정보.js가 로드되지 않았습니다.');
        const countEl = document.getElementById('seoul-data-count');
        if (countEl) countEl.textContent = '연결 대기 중...';
    }

    setupEventListeners();
    checkUticConnection();
    setInterval(checkUticConnection, 60000); // 1분마다 UTIC 상태 갱신
    startSeoulSpatPolling();
    startUticSpatPolling();
    startTableRealtimeUpdate(); // 테이블 실시간 갱신 타이머 시작
});

function initMap() {
    // Center of Korea
    map = L.map('map', {
        zoomControl: false,
        preferCanvas: true // 수천 개의 마커(CircleMarker)를 SVG 대신 캔버스에 렌더링하여 압도적인 성능 향상
    }).setView([37.5665, 126.9780], 12);

    // Dark Theme Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    // Reposition Zoom Control
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Map view change events
    map.on('moveend', () => {
        updateStatusTable();
        updateMarkerLabelsVisibility();
    });
    map.on('zoomend', () => {
        updateStatusTable();
        updateMarkerLabelsVisibility();
    });

    // Add GPS Location Button
    const locateBtn = L.control({position: 'bottomright'});
    locateBtn.onAdd = function () {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
        div.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        div.style.width = '34px';
        div.style.height = '34px';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.borderRadius = '6px';
        div.style.marginTop = '10px';
        div.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:2px;"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v2m0 16v2m10-10h-2M2 12h2"></path></svg>';
        
        div.onclick = function(e) {
            e.stopPropagation();
            map.locate({setView: true, maxZoom: 15});
        };
        return div;
    };
    locateBtn.addTo(map);

    let userMarker = null;
    map.on('locationfound', function(e) {
        if (userMarker) {
            userMarker.setLatLng(e.latlng);
        } else {
            userMarker = L.circleMarker(e.latlng, {
                radius: 8,
                fillColor: '#ef4444',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(map);
            userMarker.bindTooltip('내 위치', {permanent: true, direction: 'top', className: 'map-label', offset: [0, -10]});
        }
    });

    map.on('locationerror', function(e) {
        alert("위치 정보를 가져올 수 없습니다. 디바이스의 GPS 설정 및 브라우저 권한을 확인해주세요.");
    });
}

function renderTree() {
    const treeContainer = document.getElementById('region-tree');
    treeContainer.innerHTML = REGIONS.map(reg => `
        <div class="tree-node" id="node-${reg.code}" data-code="${reg.code}">
            <div class="tree-header" onclick="toggleTreeNode('${reg.code}')">
                <span class="arrow">▶</span>
                <span class="label" id="label-${reg.code}" data-name="${reg.name}">${reg.name}</span>
            </div>
            <div class="tree-content" id="content-${reg.code}">
                <!-- Intersections will be loaded here -->
            </div>
        </div>
    `).join('');
}

function toggleCategory(catId) {
    const node = document.getElementById(`category-${catId}`);
    const content = document.getElementById(`${catId}-region-tree`);
    const arrow = node.querySelector('.category-arrow');
    const isExpanded = node.classList.toggle('expanded');

    if (isExpanded) {
        content.style.display = 'block';
        arrow.textContent = '▼';
    } else {
        content.style.display = 'none';
        arrow.textContent = '▶';
    }
}
window.toggleCategory = toggleCategory;

async function toggleTreeNode(regionCode) {
    const node = document.getElementById(`node-${regionCode}`);
    const content = document.getElementById(`content-${regionCode}`);
    const isExpanded = node.classList.toggle('expanded');

    if (isExpanded) {
        currentRegionCode = regionCode;
        // 이미 로드된 데이터가 없으면 페치 실행
        if (content.children.length === 0) {
            await fetchIntersections('', content);
        }
    }
}

async function forceRefreshUtic(event) {
    event.stopPropagation();
    if (!currentRegionCode) {
        alert('먼저 갱신할 UTIC 지역을 선택해주세요.');
        return;
    }
    const searchInput = document.getElementById('intersection-search');
    const query = searchInput ? searchInput.value : '';
    
    // 강제 갱신 전 기존 캐시 삭제
    const cacheKey = `utic_intersections_${currentRegionCode}_${query}`;
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(cacheKey + '_date');
    
    await fetchIntersections(query, null, true);
    alert('교차로 목록 갱신을 완료했습니다.');
}
window.forceRefreshUtic = forceRefreshUtic;

async function fetchIntersections(searchQuery = '', container = null, forceRefresh = false) {
    const seoulCategory = document.getElementById('category-seoul');
    const isSeoulActive = seoulCategory && seoulCategory.classList.contains('expanded');
    
    if (isSeoulActive && typeof window.SEOUL_CROSSROAD_DATA !== 'undefined') {
        searchSeoulIntersections(searchQuery);
        return;
    }

    const listContainer = container || document.getElementById(`content-${currentRegionCode}`);
    if (!listContainer || !currentRegionCode) return;

    // LocalStorage 캐시 로직 추가
    const cacheKey = `utic_intersections_${currentRegionCode}_${searchQuery}`;
    const cacheDateKey = `${cacheKey}_date`;
    const today = new Date().toISOString().split('T')[0];

    if (!forceRefresh) {
        const cachedDate = localStorage.getItem(cacheDateKey);
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedDate === today && cachedData) {
            try {
                const items = JSON.parse(cachedData);
                renderTreeItems(items, listContainer);
                updateApiStatus('utic', true, 'Cached');
                return;
            } catch (e) {
                console.warn('Failed to parse cached UTIC data', e);
            }
        }
    }

    listContainer.innerHTML = '<p class="placeholder" style="padding:10px;">데이터 수신 중...</p>';

    try {
        const targetUrl = `${API_CONFIG.baseUrl}?serviceKey=${API_CONFIG.serviceKey}&type=json&srchCTId=${currentRegionCode}&itstNm=${encodeURIComponent(searchQuery)}&pageNo=1&numOfRows=9999`;
        const startTime = performance.now();
        const response = await window.fetchData(targetUrl);
        const endTime = performance.now();
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
            console.log('UTIC Response Data:', data);
        } catch (jsonErr) {
            console.error('Failed to parse UTIC JSON:', jsonErr, '\nRaw Text:', rawText);
            listContainer.innerHTML = '<p class="placeholder" style="padding:10px; color:#ef4444;">데이터 형식이 올바르지 않습니다. 콘솔을 확인해주세요.</p>';
            return;
        }

        updateApiStatus('utic', true, 'Connected', endTime - startTime);

        // JSON 구조 처리 (다양한 응답 형태 지원)
        let rawItems = [];
        if (Array.isArray(data)) {
            rawItems = data.slice(1);
        } else if (data && data.body && data.body.items) {
            rawItems = Array.isArray(data.body.items) ? data.body.items : [data.body.items];
        } else if (data && data.items) {
            rawItems = Array.isArray(data.items) ? data.items : [data.items];
        } else if (data && data.PlanCRRSInfo) {
            rawItems = Array.isArray(data.PlanCRRSInfo) ? data.PlanCRRSInfo : [data.PlanCRRSInfo];
        } else if (data && data.response && data.response.body && data.response.body.items) {
            rawItems = Array.isArray(data.response.body.items) ? data.response.body.items : [data.response.body.items];
        }
        
        if (!rawItems || rawItems.length === 0) {
            console.warn('UTIC API returned no items. Raw data:', data);
            listContainer.innerHTML = '<p class="placeholder" style="padding:10px; color:var(--text-muted);">검색된 교차로 데이터가 없습니다.</p>';
            return;
        }
        
        // 중복 제거를 위한 Set과 결과 배열
        const items = [];
        const seenIds = new Set();

        rawItems.forEach(item => {
            const itstId = item.INT_NO || item.itstId;
            if (!itstId || seenIds.has(itstId)) return;
            
            seenIds.add(itstId);
            const name = item.INT_NM || item.itstNm;
            
            // 좌표 보정 로직 (인천 L02 한정)
            let la = item.Y_COORD || item.la;
            let lo = item.X_COORD || item.lo;
            
            if (!la && currentRegionCode === 'L02' && typeof L02_DATA !== 'undefined') {
                const localInfo = L02_DATA.find(l => l.itstId === itstId);
                if (localInfo) {
                    la = localInfo.la;
                    lo = localInfo.lo;
                }
            }

            items.push({
                itstId: itstId,
                nodeId: item.NODE_ID,
                itstNm: name,
                la: parseFloat(la),
                lo: parseFloat(lo),
                updateTime: item.COLLCT_DTIME
            });
        });

        // 인천(L02)의 경우 로컬 데이터와 병합하여 누락된 교차로들을 모두 표시
        if (currentRegionCode === 'L02' && typeof L02_DATA !== 'undefined') {
            L02_DATA.forEach(localItem => {
                if (!seenIds.has(localItem.itstId)) {
                    seenIds.add(localItem.itstId);
                    items.push({
                        itstId: localItem.itstId,
                        nodeId: localItem.nodeId || '',
                        itstNm: localItem.itstNm,
                        la: parseFloat(localItem.la),
                        lo: parseFloat(localItem.lo),
                        updateTime: ''
                    });
                }
            });
        }

        // 필터링된 유일한 항목들만 렌더링
        let filteredItems = items.filter(item => item.itstNm);
        
        // 검색어가 있다면 병합된 전체 데이터에 대해서도 다시 필터링
        if (searchQuery) {
            filteredItems = filteredItems.filter(item => item.itstNm.includes(searchQuery) || item.itstId.includes(searchQuery));
        }

        renderTreeItems(filteredItems, listContainer);
        
        // LocalStorage에 캐싱 데이터 저장
        try {
            localStorage.setItem(cacheKey, JSON.stringify(filteredItems));
            localStorage.setItem(cacheDateKey, today);
        } catch (e) {
            console.warn('Failed to save UTIC data to localStorage', e);
        }
    } catch (error) {
        console.error('Data Load Error:', error);
        updateApiStatus('utic', false, 'Refused');
        
        if (currentRegionCode === 'L02' && typeof L02_DATA !== 'undefined') {
             const filtered = L02_DATA.filter(item => 
                !searchQuery || item.itstNm.includes(searchQuery) || item.itstId.includes(searchQuery)
            );
            renderTreeItems(filtered, listContainer);
        }
    }
}

let selectedIntersections = [];
let isMultiSelectFloatingBarHidden = false;

function handleCheckboxChange(checkbox) {
    isMultiSelectFloatingBarHidden = false;
    const el = checkbox.closest('.tree-item');
    const { la, lo, name, id, nodeId, updateTime, isSeoul } = el.dataset;
    const itemObj = {
        itstId: id,
        nodeId: nodeId,
        itstNm: name,
        la: parseFloat(la),
        lo: parseFloat(lo),
        updateTime: updateTime,
        isSeoul: isSeoul === 'true'
    };

    if (checkbox.checked) {
        if (selectedIntersections.length >= 2) {
            // FIFO: Uncheck the oldest selection to keep exactly 2
            const oldest = selectedIntersections.shift();
            const oldCheckbox = document.querySelector(`.tree-item-checkbox[data-id="${oldest.itstId}"][data-is-seoul="${oldest.isSeoul ? 'true' : ''}"]`);
            if (oldCheckbox) oldCheckbox.checked = false;
            const oldEl = document.querySelector(`.tree-item[data-id="${oldest.itstId}"][data-is-seoul="${oldest.isSeoul ? 'true' : ''}"]`);
            if (oldEl) oldEl.classList.remove('selected-multi');
        }
        selectedIntersections.push(itemObj);
        el.classList.add('selected-multi');
    } else {
        selectedIntersections = selectedIntersections.filter(x => !(x.itstId === id && !!x.isSeoul === (isSeoul === 'true')));
        el.classList.remove('selected-multi');
    }

    updateMultiSelectFloatingBar();
}

function updateMultiSelectFloatingBar() {
    const bar = document.getElementById('multi-select-bar');
    const text = document.getElementById('multi-select-text');
    const btn = document.getElementById('multi-select-btn');

    if (!bar || !text || !btn) return;

    if (selectedIntersections.length === 0 || isMultiSelectFloatingBarHidden) {
        bar.style.transform = 'translateX(-50%) translateY(150%)';
        bar.style.opacity = '0';
        bar.style.pointerEvents = 'none';
    } else if (selectedIntersections.length === 1) {
        bar.style.transform = 'translateX(-50%) translateY(0)';
        bar.style.opacity = '1';
        bar.style.pointerEvents = 'auto';
        text.innerHTML = `<strong>${selectedIntersections[0].itstNm}</strong> 선택됨 (교차로를 1개 더 선택하면 듀얼 모니터링이 활성화됩니다)`;
        btn.style.display = 'none';
    } else {
        bar.style.transform = 'translateX(-50%) translateY(0)';
        bar.style.opacity = '1';
        bar.style.pointerEvents = 'auto';
        text.innerHTML = `🚦 <strong>${selectedIntersections[0].itstNm}</strong> 🆚 <strong>${selectedIntersections[1].itstNm}</strong> 선택 완료!`;
        btn.style.display = 'block';
    }
}

function openDualOverlayFromSelection() {
    if (selectedIntersections.length === 0) return;
    
    const overlay = document.getElementById('detail-overlay');
    overlay.classList.remove('hidden');

    // Clean up current active panels
    if (activePanels[1]) activePanels[1].destroy();
    if (activePanels[2]) activePanels[2].destroy();
    activePanels = { 1: null, 2: null };

    // Load first item into Slot 1
    activePanels[1] = new DetailPanel(1, selectedIntersections[0]);

    if (selectedIntersections.length > 1) {
        // Load second item into Slot 2
        document.getElementById('detail-container-2').style.display = 'flex';
        activePanels[2] = new DetailPanel(2, selectedIntersections[1]);
    } else {
        document.getElementById('detail-container-2').style.display = 'none';
    }
}

window.handleCheckboxChange = handleCheckboxChange;
window.openDualOverlayFromSelection = openDualOverlayFromSelection;
window.cancelDualMonitoring = function() {
    isMultiSelectFloatingBarHidden = true;
    updateMultiSelectFloatingBar();
};

function renderTreeItems(items, container) {
    if (container && container.id && container.id.startsWith('content-')) {
        const regionCode = container.id.replace('content-', '');
        const labelEl = document.getElementById(`label-${regionCode}`);
        if (labelEl) {
            const orgName = labelEl.getAttribute('data-name');
            labelEl.textContent = `${orgName} (${items.length})`;
        }
    }

    if (items.length === 0) {
        container.innerHTML = '<p class="placeholder" style="padding:10px;">데이터가 없습니다.</p>';
        return;
    }

    updateMapMarkers(items);

    // 가상 스크롤(Virtual Scrolling) 구현
    const ITEM_HEIGHT = 38; // CSS .tree-item의 높이(padding, margin 등 포함)
    const BUFFER = 10; // 스크롤 시 위아래로 미리 그려놓을 여유 아이템 개수

    function renderVirtualList() {
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight || 400; // 폴백 높이
        
        // 현재 화면에 보여야 할 아이템들의 인덱스 계산
        const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
        const endIndex = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER);
        
        const visibleItems = items.slice(startIndex, endIndex);
        
        const contentHtml = visibleItems.map(item => {
            const statInfo = getIntersectionStatusAndColor(item.itstId, item.isSeoul);
            const dotColor = statInfo.style.fillColor === 'transparent' ? statInfo.style.color : statInfo.style.fillColor;
            const isChecked = selectedIntersections.some(x => x.itstId === item.itstId && !!x.isSeoul === !!item.isSeoul) ? 'checked' : '';
            return `
                <div class="tree-item ${isChecked ? 'selected-multi' : ''}" data-id="${item.itstId}" data-node-id="${item.nodeId || ''}" data-la="${item.la}" data-lo="${item.lo}" data-name="${item.itstNm}" data-update-time="${item.updateTime || ''}" data-is-seoul="${item.isSeoul ? 'true' : ''}">
                    <input type="checkbox" class="tree-item-checkbox" data-id="${item.itstId}" data-is-seoul="${item.isSeoul ? 'true' : ''}" ${isChecked} onclick="event.stopPropagation(); handleCheckboxChange(this)" style="margin-right: 8px; cursor: pointer; accent-color: var(--accent-primary); width: 14px; height: 14px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3);">
                    <span class="status-dot" style="background-color: ${dotColor}; box-shadow: 0 0 8px ${dotColor};"></span>
                    <span class="id-label">[${item.itstId}]</span>
                    <span class="name-label">${item.itstNm}</span>
                </div>
            `;
        }).join('');
        
        let contentDiv = container.querySelector('.vs-content');
        if (!contentDiv) {
            // 처음 렌더링 시 전체 높이를 잡는 빈 공간(spacer)과 실제 내용물(content) 구조 셋팅
            container.innerHTML = `
                <div class="vs-spacer" style="height: ${items.length * ITEM_HEIGHT}px; width: 1px;"></div>
                <div class="vs-content" style="position: absolute; top: 0; left: 0; width: 100%;"></div>
            `;
            container.style.position = 'relative'; 
            contentDiv = container.querySelector('.vs-content');
        } else {
            // 검색 필터링 등으로 항목 개수가 달라질 경우 spacer 높이 갱신
            container.querySelector('.vs-spacer').style.height = `${items.length * ITEM_HEIGHT}px`;
        }
        
        // 스크롤 위치에 맞춰 내용물을 Y축으로 이동 (마치 스크롤되는 것처럼 보이게)
        contentDiv.style.transform = `translateY(${startIndex * ITEM_HEIGHT}px)`;
        contentDiv.innerHTML = contentHtml;
    }

    // 최초 렌더링
    renderVirtualList();

    // 중복 스크롤 이벤트 리스너 방지
    if (container._vsHandler) {
        container.removeEventListener('scroll', container._vsHandler);
    }
    container._vsHandler = () => requestAnimationFrame(renderVirtualList);
    container.addEventListener('scroll', container._vsHandler);

    // 이벤트 위임(Event Delegation)을 통한 교차로 클릭 성능 최적화
    if (!container.dataset.eventBound) {
        container.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.tree-item');
            if (!itemEl) return;
            
            // 체크박스를 직접 클릭한 경우는 제외 (onclick 인라인 속성에서 처리됨)
            if (e.target.classList.contains('tree-item-checkbox')) return;

            const checkbox = itemEl.querySelector('.tree-item-checkbox');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                handleCheckboxChange(checkbox);
            }
            
            const { la, lo, name, id, nodeId, updateTime, isSeoul } = itemEl.dataset;
            focusIntersection(parseFloat(la), parseFloat(lo), name, id, nodeId, updateTime, isSeoul === 'true');
        });
        container.dataset.eventBound = 'true';
    }
}

function parseXml(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    // 여러 가능한 아이템 태그 확인
    let items = xmlDoc.getElementsByTagName("PlanCRRSInfo");
    if (items.length === 0) items = xmlDoc.getElementsByTagName("item");

    return Array.from(items).map(item => {
        const id = item.getElementsByTagName("INT_NO")[0]?.textContent || item.getElementsByTagName("itstId")[0]?.textContent;
        const nodeId = item.getElementsByTagName("NODE_ID")[0]?.textContent || item.getElementsByTagName("nodeId")[0]?.textContent;
        const name = item.getElementsByTagName("INT_NM")[0]?.textContent || item.getElementsByTagName("itstNm")[0]?.textContent;
        
        // 좌표 파싱 (X_COORD/Y_COORD 또는 la/lo)
        let lat = item.getElementsByTagName("Y_COORD")[0]?.textContent || item.getElementsByTagName("la")[0]?.textContent;
        let lng = item.getElementsByTagName("X_COORD")[0]?.textContent || item.getElementsByTagName("lo")[0]?.textContent;

        lat = parseFloat(lat);
        lng = parseFloat(lng);

        if (lat > 1000) lat = lat / 10000000;
        if (lng > 1000) lng = lng / 10000000;

        if (name === "신광4거리" && (!lat || !lng)) {
            lat = 37.4643680; lng = 126.6360530;
        }

        return { itstId: id, nodeId: nodeId, itstNm: name, la: lat, lo: lng };
    }).filter(item => item.itstId && item.itstNm); 
}

// renderIntersectionList 대신 renderTreeItems를 사용하므로 제거 또는 수정 가능
// 여기서는 중복 제거를 위해 fetchIntersections와 연계하여 리팩토링됨

function getIntersectionStatusAndColor(itstId, isSeoul) {
    if (isSeoul) {
        const spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[itstId];
        if (spat) {
            return {
                style: { radius: 8, weight: 2, color: '#fff', opacity: 1, fillOpacity: 0.8, fillColor: '#3b82f6' },
                statusText: '정상수신',
                opMode: '정상',
                isCommOk: true,
                trans: 'OFF', act: 'OFF', dark: 'OFF', flash: 'OFF', manual: 'OFF'
            };
        } else {
            return {
                style: { radius: 8, weight: 2, color: '#475569', opacity: 1, fillOpacity: 0.6, fillColor: '#64748b' },
                statusText: '대기 중',
                opMode: '대기',
                isCommOk: false,
                trans: 'OFF', act: 'OFF', dark: 'OFF', flash: 'OFF', manual: 'OFF'
            };
        }
    }

    const spat = window.UTIC_SPAT_MAP && window.UTIC_SPAT_MAP[itstId];
    if (spat) {
        return {
            style: { radius: 8, weight: 2, color: '#fff', opacity: 1, fillOpacity: 0.8, fillColor: '#3b82f6' },
            statusText: spat.opMode || '수신 중',
            opMode: spat.opMode || '수신',
            isCommOk: true,
            trans: 'OFF', act: 'OFF', dark: 'OFF', flash: 'OFF', manual: 'OFF'
        };
    } else {
        return {
            style: { radius: 8, weight: 2, color: '#475569', opacity: 1, fillOpacity: 0.6, fillColor: '#64748b' },
            statusText: '대기 중',
            opMode: '대기',
            isCommOk: false,
            trans: 'OFF', act: 'OFF', dark: 'OFF', flash: 'OFF', manual: 'OFF'
        };
    }
}
window.getIntersectionStatusAndColor = getIntersectionStatusAndColor;

function updateMapMarkers(items) {
    // Clear old markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const bounds = [];

    items.forEach(item => {
        if (item.la && item.lo) {
            const statInfo = getIntersectionStatusAndColor(item.itstId, item.isSeoul);
            item._statusInfo = statInfo; // save for table

            const marker = L.circleMarker([item.la, item.lo], {
                radius: statInfo.style.radius,
                fillColor: statInfo.style.fillColor,
                color: statInfo.style.color,
                weight: statInfo.style.weight,
                opacity: statInfo.style.opacity,
                fillOpacity: statInfo.style.fillOpacity,
                item: item // 상태 테이블 업데이트를 위해 데이터 객체 저장
            }).addTo(map);

            const isZoomedIn = map.getZoom() >= 15;
            marker.bindTooltip(item.itstNm, { 
                permanent: items.length <= 100 || isZoomedIn, 
                direction: 'top', 
                offset: [0, -10],
                className: 'map-label'
            });
            marker.on('click', () => {
                // 지도에서 마커 클릭 시 목록의 체크박스도 연동하여 선택
                const checkbox = document.querySelector(`.tree-item-checkbox[data-id="${item.itstId}"]`);
                if (checkbox && !checkbox.checked) {
                    checkbox.checked = true;
                    handleCheckboxChange(checkbox);
                }
                focusIntersection(item.la, item.lo, item.itstNm, item.itstId, item.nodeId, item.updateTime, item.isSeoul);
            });

            markers.push(marker);
            bounds.push([item.la, item.lo]);
        }
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }

    window.markers = markers; // Sync global markers array
    updateStatusTable();
}

function updateMarkerLabelsVisibility() {
    if (!map || !markers) return;
    const isZoomedIn = map.getZoom() >= 16;
    const mapBounds = map.getBounds();
    
    markers.forEach(marker => {
        const tooltip = marker.getTooltip();
        if (tooltip) {
            const isVisible = mapBounds.contains(marker.getLatLng());
            const shouldBePermanent = isZoomedIn && isVisible;

            if (shouldBePermanent && !tooltip.options.permanent) {
                marker.unbindTooltip();
                marker.bindTooltip(marker.options.item.itstNm, { permanent: true, direction: 'top', offset: [0, -10], className: 'map-label' });
            } else if (!shouldBePermanent && tooltip.options.permanent) {
                marker.unbindTooltip();
                marker.bindTooltip(marker.options.item.itstNm, { permanent: false, direction: 'top', offset: [0, -10], className: 'map-label' });
            }
        }
    });
}

function updateStatusTable() {
    const tableBody = document.getElementById('status-table-body');
    const visibleCountEl = document.getElementById('visible-count');
    if (!tableBody || !map) return;

    const mapBounds = map.getBounds();
    const visibleItems = [];
    
    markers.forEach(marker => {
        if (mapBounds.contains(marker.getLatLng())) {
            if (marker.options.item) {
                visibleItems.push(marker.options.item);
            }
        }
    });

    visibleCountEl.textContent = `표시 항목: ${visibleItems.length}개`;

    if (visibleItems.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="13" style="padding:40px; opacity:0.5; text-align:center;">지도 가시 영역 내에 교차로가 없습니다.</td></tr>';
        return;
    }

    let regionName = REGIONS.find(r => r.code === currentRegionCode)?.name;
    if (!regionName && typeof currentSeoulGuCode !== 'undefined' && currentSeoulGuCode) {
        regionName = `서울시 ${SEOUL_DISTRICTS[currentSeoulGuCode] || ''}`;
    }
    if (!regionName) regionName = '-';

    tableBody.innerHTML = visibleItems.map(item => {
        let cycleValue = '-';
        let timeValue = '-';
        
        if (item.isSeoul) {
            if (window.SEOUL_SPAT_LAST_UPDATE && window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[item.itstId]) {
                timeValue = window.SEOUL_SPAT_LAST_UPDATE.toLocaleTimeString('ko-KR', { hour12: false });
            }
        } else if (isApiConnected) {
            if (item.updateTime) {
                timeValue = String(item.updateTime).substring(8).replace(/(\d{2})(\d{2})(\d{2})/, '$1:$2:$3');
            } else {
                timeValue = new Date().toLocaleTimeString('ko-KR', { hour12: false });
            }
            if (typeof L02_DETAIL_DATA !== 'undefined' && !item._cycleLength) {
                const conf = L02_DETAIL_DATA.find(d => d.INT_NO == item.itstId);
                let cycleLen = 120;
                if (conf) {
                    let sumA = 0, sumB = 0;
                    for (let i=1; i<=8; i++) {
                        const aCode = conf[`A_RING_${i}_PHASE_CONF_CD`];
                        const bCode = conf[`B_RING_${i}_PHASE_CONF_CD`];
                        if(aCode){let v=parseInt(aCode.substring(4,7),10)/10; sumA+=(isNaN(v)||v<=0)?20:v;}
                        if(bCode){let v=parseInt(bCode.substring(4,7),10)/10; sumB+=(isNaN(v)||v<=0)?20:v;}
                    }
                    if(Math.max(sumA, sumB)>0) cycleLen = Math.max(sumA, sumB);
                }
                item._cycleLength = cycleLen;
                item._simCycle = Math.floor(Math.random() * cycleLen) + 1;
            }
            if (item._simCycle !== undefined) cycleValue = item._simCycle;
        }

        const statInfo = item._statusInfo || getIntersectionStatusAndColor(item.itstId, item.isSeoul);
        
        const transClass = statInfo.trans === 'ON' ? 'val-normal' : 'val-off';
        const actClass = statInfo.act === 'ON' ? 'val-normal' : 'val-off';
        const darkClass = statInfo.dark === 'ON' ? 'val-normal font-weight:700;' : 'val-off';
        const flashClass = statInfo.flash === 'ON' ? 'val-normal font-weight:700;' : 'val-off';
        const manualClass = statInfo.manual === 'ON' ? 'val-normal font-weight:700;' : 'val-off';

        return `
            <tr data-id="${item.itstId}" onclick="focusIntersection(${item.la}, ${item.lo}, '${item.itstNm}', '${item.itstId}', '${item.nodeId}', '${item.updateTime}')">
                <td>${regionName}</td>
                <td class="val-highlight">${item.itstId}</td>
                <td style="text-align: left; font-weight: 600;">${item.itstNm}</td>
                <td class="${transClass}">${statInfo.trans}</td>
                <td class="${actClass}">${statInfo.act}</td>
                <td class="${darkClass}">${statInfo.dark}</td>
                <td class="${flashClass}">${statInfo.flash}</td>
                <td class="${manualClass}">${statInfo.manual}</td>
                <td class="${statInfo.isCommOk ? 'val-normal' : 'val-error'}">${statInfo.isCommOk ? '정상' : '이상'}</td>
                <td class="${statInfo.isCommOk ? 'val-normal' : 'val-error'}">${statInfo.isCommOk ? '정상' : '이상'}</td>
                <td class="val-normal">정상</td>
                <td class="val-highlight cycle-cell">${cycleValue}</td>
                <td class="time-cell" style="font-size: 10px; opacity: 0.8;">${timeValue}</td>
            </tr>
        `;
    }).join('');
}

// UTIC 데이터 수신(isApiConnected) 시에만 정적 데이터를 기반으로 카운트다운 진행
function startTableRealtimeUpdate() {
    setInterval(() => {
        if (!isApiConnected) return;

        const rows = document.querySelectorAll('#status-table-body tr');
        rows.forEach(row => {
            const itstId = row.dataset.id;
            const cycleCell = row.querySelector('.cycle-cell');
            
            if (cycleCell && cycleCell.textContent !== '-') {
                let currentCycle = parseInt(cycleCell.textContent);
                if (isNaN(currentCycle)) return;
                
                const marker = markers.find(m => m.options.item && m.options.item.itstId === itstId);
                const cycleLen = marker && marker.options.item._cycleLength ? marker.options.item._cycleLength : 120;
                
                currentCycle = currentCycle <= 1 ? cycleLen : currentCycle - 1;
                cycleCell.textContent = currentCycle;
                
                if (marker) marker.options.item._simCycle = currentCycle;
            }
        });
    }, 1000);
}

window.openDetailFromPopup = function(lat, lng, name, id, nodeId, updateTime, isSeoulStr) {
    const isSeoul = isSeoulStr === 'true';
    const item = {
        itstId: id,
        nodeId: nodeId,
        itstNm: name,
        la: parseFloat(lat),
        lo: parseFloat(lng),
        updateTime: updateTime,
        isSeoul: isSeoul
    };
    openDetailOverlay(item);
    if (map) map.closePopup();
};

function focusIntersection(lat, lng, name, id, nodeId, updateTime, isSeoul) {
    // 자연스러운 flyTo 애니메이션이 불편하다는 요청에 따라 즉시 찾아가도록 변경
    map.setView([lat, lng], 17);

    // 사이드바 목록에서 해당 교차로를 하이라이트 (가상 스크롤 상태이므로 화면에 있으면 active)
    document.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
    const treeItem = document.querySelector(`.tree-item[data-id="${id}"]`);
    if (treeItem) {
        treeItem.classList.add('active');
    }

    // 지도 위 교차로 위치에 팝업 띄우기 (버튼 클릭 시 상세 모니터링 창 실행)
    const popupContent = `
        <div style="text-align:center; padding: 5px;">
            <strong style="display:block; margin-bottom:8px; font-size:14px; color: #333;">${name}</strong>
            <button onclick="openDetailFromPopup('${lat}', '${lng}', '${name}', '${id}', '${nodeId}', '${updateTime}', '${isSeoul}')" 
                    style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">
                상세보기
            </button>
        </div>
    `;

    L.popup({ autoClose: true, closeOnClick: true, offset: [0, -10] })
        .setLatLng([lat, lng])
        .setContent(popupContent)
        .openOn(map);
}


let activePanels = { 1: null, 2: null };

function updateNavBadge() {
    const navBtn = document.getElementById('nav-to-slot2');
    const container2 = document.getElementById('detail-container-2');
    const wrapper = document.getElementById('dual-monitor-wrapper');
    if (!navBtn || !container2 || !wrapper) return;

    const isSlot2Open = container2.style.display !== 'none';
    const isEnlarged = wrapper.classList.contains('enlarged-map-mode');

    if (isSlot2Open && !isEnlarged) {
        navBtn.style.display = 'flex';
    } else {
        navBtn.style.display = 'none';
    }
}

function openDetailOverlay(item) {
    const overlay = document.getElementById('detail-overlay');
    overlay.classList.remove('hidden');

    let slot = 1;
    if (activePanels[1] && activePanels[1].item.itstId !== item.itstId) {
        if (!activePanels[2]) {
            slot = 2;
        } else {
            slot = 2; // replace slot 2
        }
    } else if (activePanels[1] && activePanels[1].item.itstId === item.itstId) {
        slot = 1;
    } else if (activePanels[2] && activePanels[2].item.itstId === item.itstId) {
        slot = 2;
    }

    if (slot === 2) {
        document.getElementById('detail-container-2').style.display = 'flex';
        const nameEl = document.getElementById('nav-slot2-name');
        if (nameEl) nameEl.textContent = item.itstNm;
    }

    if (activePanels[slot]) {
        activePanels[slot].destroy();
    }

    activePanels[slot] = new DetailPanel(slot, item);
    updateNavBadge();
}

function closeDetailOverlay() {
    document.getElementById('detail-overlay').classList.add('hidden');
    document.getElementById('detail-container-2').style.display = 'none';
    if (activePanels[1]) { activePanels[1].destroy(); activePanels[1] = null; }
    if (activePanels[2]) { activePanels[2].destroy(); activePanels[2] = null; }
    setDetailViewMode('all');
    updateNavBadge();
}

function setDetailViewMode(mode) {
    const btnAll = document.getElementById('btn-mode-all');
    const btnMap = document.getElementById('btn-mode-map');
    const containers = document.querySelectorAll('.detail-container');
    const wrapper = document.getElementById('dual-monitor-wrapper');
    
    if (mode === 'map') {
        if (btnAll) {
            btnAll.style.background = 'rgba(255,255,255,0.05)';
            btnAll.style.color = 'white';
        }
        if (btnMap) {
            btnMap.style.background = 'var(--accent-primary)';
            btnMap.style.color = 'var(--bg-dark)';
        }
        containers.forEach(c => c.classList.add('enlarged-map-mode'));
        if (wrapper) wrapper.classList.add('enlarged-map-mode');
    } else {
        if (btnAll) {
            btnAll.style.background = 'var(--accent-primary)';
            btnAll.style.color = 'var(--bg-dark)';
        }
        if (btnMap) {
            btnMap.style.background = 'rgba(255,255,255,0.05)';
            btnMap.style.color = 'white';
        }
        containers.forEach(c => c.classList.remove('enlarged-map-mode'));
        if (wrapper) wrapper.classList.remove('enlarged-map-mode');
    }
    
    updateNavBadge();
    
    // Trigger Leaflet map invalidateSize to redraw full-screen maps correctly!
    setTimeout(() => {
        if (activePanels[1] && activePanels[1].detailMap) activePanels[1].detailMap.invalidateSize();
        if (activePanels[2] && activePanels[2].detailMap) activePanels[2].detailMap.invalidateSize();
    }, 100);
}
window.setDetailViewMode = setDetailViewMode;

function switchDetailTab(tabId, btnElement) {
    if(!btnElement) return;
    const container = btnElement.closest('.detail-container');
    const slot = container.id.split('-').pop();
    
    container.querySelectorAll('.detail-tab-btn').forEach(btn => btn.classList.remove('active'));
    container.querySelectorAll('.detail-tab-content').forEach(content => content.style.display = 'none');
    
    btnElement.classList.add('active');
    if (tabId === 'status') {
        container.querySelector('#tab-current-status-' + slot).style.display = 'block';
    } else {
        container.querySelector('#tab-sigmap-table-' + slot).style.display = 'block';
    }
}


function parseSigMapXml(xmlString, targetId) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    let items = xmlDoc.getElementsByTagName("SigMapCRInfo");
    if (items.length === 0) items = xmlDoc.getElementsByTagName("item");
    
    console.log("SigMap XML parsing, items found:", items.length);
    
    const stepsA = [];
    const stepsB = [];
    if (items.length > 0) {
        const firstIntNo = items[0].getElementsByTagName("INT_NO")[0]?.textContent;
        
        for (let item of items) {
            const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
            if (intNo === firstIntNo) {
                const ringNo = item.getElementsByTagName("RING_NO")[0]?.textContent || '0';
                const step = {
                    stepNo: parseInt(item.getElementsByTagName("STEP_NO")[0]?.textContent || 0),
                    minTm: parseInt(item.getElementsByTagName("MIN_TM")[0]?.textContent || 0),
                    maxTm: parseInt(item.getElementsByTagName("MAX_TM")[0]?.textContent || 0),
                    eop: parseInt(item.getElementsByTagName("EOP")[0]?.textContent || 0)
                };
                for (let i=1; i<=8; i++) {
                    step[`car${i}`] = parseInt(item.getElementsByTagName(`CAR${i}`)[0]?.textContent || 0);
                    step[`ped${i}`] = parseInt(item.getElementsByTagName(`PED${i}`)[0]?.textContent || 0);
                }
                if (ringNo === '1' || ringNo === '2' || ringNo === 'B') {
                    if (!stepsB.some(s => s.stepNo === step.stepNo)) stepsB.push(step);
                } else {
                    if (!stepsA.some(s => s.stepNo === step.stepNo)) stepsA.push(step);
                }
            }
        }
    }
    
    stepsA.sort((a, b) => a.stepNo - b.stepNo);
    stepsB.sort((a, b) => a.stepNo - b.stepNo);
    return { ringA: stepsA, ringB: stepsB };
}

async function fetchPlanCRWD(itstId, itstNm) {
    const planContent = document.getElementById('plan-wd-content');
    if (planContent) planContent.innerHTML = '<p class="placeholder" style="font-size:11px; margin-top: 10px;">요일계획 불러오는 중...</p>';

    try {
        const targetUrl = `${API_CONFIG.planWdUrl}?serviceKey=${API_CONFIG.serviceKey}&type=xml&srchCTId=${currentRegionCode}&srchCRNm=${encodeURIComponent(itstNm)}&pageNo=1&numOfRows=10`;
        const response = await window.fetchData(targetUrl);
        const text = await response.text();
        updateApiStatus('utic', true);
        const data = parseWdXml(text, itstId);
        
        renderPlanWdTable(data);
    } catch (error) {
        console.error('Plan Fetch Error:', error);
        updateApiStatus('utic', false, 'Proxy Error');
        if (planContent) planContent.innerHTML = '<p class="placeholder">실패</p>';
    }
}

function parseWdXml(xmlString, targetId) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    let items = xmlDoc.getElementsByTagName("PlanCRWDInfo");
    if (items.length === 0) items = xmlDoc.getElementsByTagName("item");
    
    const plans = [];
    for (let item of items) {
        const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
        if (intNo === targetId) {
            plans.push({
                day: parseInt(item.getElementsByTagName("PLAN_DY")[0]?.textContent),
                planNo: item.getElementsByTagName("INT_PLAN_NO")[0]?.textContent,
                regionCd: item.getElementsByTagName("REGION_CD")[0]?.textContent,
                controlCd: item.getElementsByTagName("RESRV_CONTRL_CD")[0]?.textContent,
                updateTime: item.getElementsByTagName("COLLCT_DTIME")[0]?.textContent
            });
        }
    }
    return plans.sort((a, b) => a.day - b.day);
}

// 코드 매핑 유틸리티
const CODE_MAP = {
    PLAN_DY: {
        1: '월요일', 2: '화요일', 3: '수요일', 4: '목요일', 
        5: '금요일', 6: '토요일', 7: '일요일',
        8: '평일', 9: '공휴일'
    },
    CONTROL: {
        1: '조광 제어', 2: '점멸 제어', 3: '소등 제어', 4: '시차 제어',
        5: '감응 제어', 6: '보행 활성', 7: '음향 발생', 8: '감응+푸시',
        9: '시차+감응+푸시', 10: 'PPC제어', 11: '단독 앞막힘'
    }
};

function renderPlanWdTable(plans) {
    const planContent = document.getElementById('plan-wd-content');
    if (!planContent) return;

    if (plans.length === 0) {
        planContent.innerHTML = '<p class="placeholder" style="font-size:11px;">요일계획 정보가 없습니다.</p>';
        return;
    }

    // 요일별 계획 및 제어 정보 매핑
    const dayMap = {};
    const ctrlMap = {};
    plans.forEach(p => {
        dayMap[p.day] = p.planNo;
        ctrlMap[p.day] = p.controlCd;
    });

    const days = [
        { code: 1, name: '월' }, { code: 2, name: '화' }, { code: 3, name: '수' },
        { code: 4, name: '목' }, { code: 5, name: '금' }, { code: 6, name: '토' },
        { code: 7, name: '일' }
    ];

    planContent.innerHTML = `
        <div class="table-section">
            <h4 style="font-size: 11px; color: var(--accent-primary); margin-bottom: 8px;">[ 요일별 신호계획 번호 ]</h4>
            <div class="glass-inner" style="overflow: hidden; margin-bottom: 20px;">
                <table style="width: 100%; font-size: 11px; border-collapse: collapse; text-align: center;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05); color: var(--text-muted);">
                            ${days.map(d => `<th style="padding: 10px 5px; border: 1px solid rgba(255,255,255,0.05);">${d.name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            ${days.map(d => `
                                <td style="padding: 12px 5px; border: 1px solid rgba(255,255,255,0.05);">
                                    <span style="font-weight: 700; color: ${dayMap[d.code] ? 'var(--accent-primary)' : 'var(--text-muted)'};">
                                        ${dayMap[d.code] ? `${dayMap[d.code]}번` : '-'}
                                    </span>
                                </td>
                            `).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="table-section">
            <h4 style="font-size: 11px; color: var(--accent-primary); margin-bottom: 8px;">[ 요일별 예약 제어 계획 ]</h4>
            <div class="glass-inner" style="overflow: hidden;">
                <table style="width: 100%; font-size: 10px; border-collapse: collapse; text-align: center;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05); color: var(--text-muted);">
                            ${days.map(d => `<th style="padding: 10px 5px; border: 1px solid rgba(255,255,255,0.05);">${d.name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            ${days.map(d => {
                                const ctrlCode = ctrlMap[d.code];
                                const ctrlName = CODE_MAP.CONTROL[ctrlCode] || '-';
                                return `
                                    <td style="padding: 12px 5px; border: 1px solid rgba(255,255,255,0.05); vertical-align: middle;">
                                        <div style="line-height: 1.2;">
                                            <div style="font-weight: 700; color: ${ctrlCode ? 'var(--text-main)' : 'var(--text-muted)'};">
                                                ${ctrlName}
                                            </div>
                                            ${ctrlCode ? `<div style="font-size: 9px; opacity: 0.5;">(${ctrlCode})</div>` : ''}
                                        </div>
                                    </td>
                                `;
                            }).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 15px; text-align: right;">
            수집시각: ${plans[0]?.updateTime || '-'}
        </div>
    `;
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
}
window.switchTab = switchTab;

function setupEventListeners() {
    document.getElementById('search-btn').addEventListener('click', () => {
        const query = document.getElementById('intersection-search').value;
        fetchIntersections(query);
    });

    document.getElementById('intersection-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchIntersections(e.target.value);
        }
    });

    document.querySelector('.close-btn').addEventListener('click', () => {
        document.getElementById('info-panel').classList.add('hidden');
    });

    document.getElementById('info-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (btn) switchTab(btn.dataset.tab);
    });

    // 상세 오버레이 닫기 버튼
    document.querySelector('.overlay-close-btn').addEventListener('click', closeDetailOverlay);
    const closeSlot2 = document.getElementById('close-slot-2');
    if(closeSlot2) {
        closeSlot2.addEventListener('click', () => {
            document.getElementById('detail-container-2').style.display = 'none';
            if(activePanels[2]) {
                activePanels[2].destroy();
                activePanels[2] = null;
            }
            updateNavBadge();
        });
    }
    document.getElementById('btn-show-detail').addEventListener('click', () => {
        if (selectedIntersections.length > 0) {
            openDualOverlayFromSelection();
        } else {
            const id = document.getElementById('val-itst-id').textContent;
            const isSeoul = document.getElementById('val-itst-id').dataset.isSeoul === 'true';
            const item = markers.find(m => m.options.item && m.options.item.itstId === id && !!m.options.item.isSeoul === isSeoul)?.options.item;
            if (item) {
                const checkbox = document.querySelector(`.tree-item-checkbox[data-id="${item.itstId}"][data-is-seoul="${isSeoul ? 'true' : ''}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                    handleCheckboxChange(checkbox);
                } else {
                    selectedIntersections.push(item);
                }
                openDualOverlayFromSelection();
            }
        }
    });
}

// Mock data generator for testing UI without a valid API key/CORS
function showMockData(query, container = null) {
    const listContainer = container || document.getElementById(`content-${currentRegionCode}`);
    const regionName = REGIONS.find(r => r.code === currentRegionCode)?.name || '선택 지역';
    
    const mockItems = [
        { itstId: '1001', itstNm: `${regionName} 교차로 A`, la: 37.5665 + (Math.random() - 0.5) * 0.1, lo: 126.9780 + (Math.random() - 0.5) * 0.1 },
        { itstId: '1002', itstNm: `${regionName} 삼거리 B`, la: 37.5665 + (Math.random() - 0.5) * 0.1, lo: 126.9780 + (Math.random() - 0.5) * 0.1 },
        { itstId: '1003', itstNm: `${regionName} 네거리 C`, la: 37.5665 + (Math.random() - 0.5) * 0.1, lo: 126.9780 + (Math.random() - 0.5) * 0.1 }
    ].filter(item => !query || item.itstNm.includes(query));

    renderTreeItems(mockItems, listContainer);
}

// ==========================================
// 서울Tdata 개방데이터 트리 & 가공 처리 모듈
// ==========================================
const SEOUL_DISTRICTS = {
    '000': '서울시 전체',
    '110': '종로구', '140': '중구', '170': '용산구', '200': '성동구', '210': '광진구',
    '230': '동대문구', '260': '중랑구', '290': '성북구', '300': '강북구', '320': '도봉구',
    '350': '노원구', '380': '은평구', '410': '서대문구', '440': '마포구', '470': '양천구',
    '500': '강서구', '530': '구로구', '540': '금천구', '560': '영등포구', '590': '동작구',
    '620': '관악구', '650': '서초구', '680': '강남구', '710': '송파구', '740': '강동구'
};
window.SEOUL_DISTRICTS = SEOUL_DISTRICTS;

let currentSeoulGuCode = '';
window.currentSeoulGuCode = currentSeoulGuCode;

function renderSeoulTree() {
    const treeContainer = document.getElementById('seoul-tree');
    if (!treeContainer || !window.SEOUL_CROSSROAD_DATA) return;
    
    const dataList = window.SEOUL_CROSSROAD_DATA.DATA;
    
    // 전체 목록을 단일 폴더 렌더링 방식이 아닌 평면적인 아이템 리스트로 표시
    const items = dataList.map(item => {
        return {
            itstId: String(item.itstId),
            nodeId: String(item.itstId),
            itstNm: item.intr_nm,
            la: item.la,
            lo: item.lo,
            updateTime: new Date().toISOString().split('T')[0],
            isSeoul: true
        };
    }).filter(x => x.la && x.lo);

    // 단일 평면 리스트를 트리 컨테이너에 직접 렌더링
    renderTreeItems(items, treeContainer);
    
    const countEl = document.getElementById('seoul-data-count');
    if (countEl) {
        countEl.textContent = `${items.length.toLocaleString()}개 교차로`;
    }
}
window.renderSeoulTree = renderSeoulTree;

function toggleSeoulTreeNode(guCode) {
    // 이제 평면 리스트이므로 폴더 토글 불필요 (하위 호환성 유지용 빈 함수)
}
window.toggleSeoulTreeNode = toggleSeoulTreeNode;

const proj5186 = '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs';
const projWgs84 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';

function convertSeoulCoord(x, y) {
    try {
        const floatX = parseFloat(x);
        const floatY = parseFloat(y);
        if (isNaN(floatX) || isNaN(floatY)) return null;
        
        // proj4 변환
        const result = proj4(proj5186, projWgs84, [floatX, floatY]);
        return {
            lo: result[0], // 경도 (lo)
            la: result[1]  // 위도 (la)
        };
    } catch (e) {
        console.error('Projection conversion error:', e);
        return null;
    }
}
window.convertSeoulCoord = convertSeoulCoord;

function renderSeoulIntersections(guCode, container) {
    if (!window.SEOUL_CROSSROAD_DATA) return;
    const dataList = window.SEOUL_CROSSROAD_DATA.DATA;
    const districtIntersections = dataList.filter(item => item.gu_cd === guCode);
    
    const items = districtIntersections.map(item => {
        return {
            itstId: String(item.itstId),
            nodeId: String(item.itstId), // fallback nodeId
            itstNm: item.intr_nm,
            la: item.la,
            lo: item.lo,
            updateTime: new Date().toISOString().split('T')[0],
            isSeoul: true
        };
    }).filter(x => x.la && x.lo);

    renderTreeItems(items, container);
}
window.renderSeoulIntersections = renderSeoulIntersections;

function searchSeoulIntersections(searchQuery) {
    if (!window.SEOUL_CROSSROAD_DATA) return;
    
    const dataList = window.SEOUL_CROSSROAD_DATA.DATA;
    const query = searchQuery.trim().toLowerCase();
    
    const matched = dataList.filter(item => {
        const name = (item.intr_nm || '').toLowerCase();
        const code = String(item.itstId || '');
        return name.includes(query) || code.includes(query);
    });
    
    const items = matched.slice(0, 150).map(item => {
        return {
            itstId: String(item.itstId),
            nodeId: String(item.itstId), // fallback nodeId
            itstNm: item.intr_nm,
            la: item.la,
            lo: item.lo,
            updateTime: new Date().toISOString().split('T')[0],
            isSeoul: true
        };
    }).filter(x => x.la && x.lo);

    if (query) {
        // Clear all expanded/active styles in the tree
        document.querySelectorAll('#seoul-tree .tree-node').forEach(node => {
            node.classList.remove('expanded');
            const content = node.querySelector('.tree-content');
            if (content) content.innerHTML = '';
        });
        
        // Show search results directly inside #seoul-tree
        const treeContainer = document.getElementById('seoul-tree');
        treeContainer.innerHTML = `
            <div style="padding: 10px; font-size: 0.8rem; color: var(--accent-secondary); font-weight: 600; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px;">
                <span>🔍 검색 결과 (${matched.length}건)</span>
                <button onclick="clearSeoulSearch()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.75rem; font-weight:bold;">취소</button>
            </div>
            <div id="seoul-search-results"></div>
        `;
        const resultsContainer = document.getElementById('seoul-search-results');
        renderTreeItems(items, resultsContainer);
    } else {
        clearSeoulSearch();
    }
}
window.searchSeoulIntersections = searchSeoulIntersections;

function clearSeoulSearch() {
    const searchInput = document.getElementById('intersection-search');
    if (searchInput) searchInput.value = '';
    renderSeoulTree();
}
window.clearSeoulSearch = clearSeoulSearch;

window.SEOUL_SPAT_MAP = {};
window.SEOUL_SPAT_LAST_UPDATE = null;

async function startSeoulSpatPolling() {
    // [TEST MODE] 실제 API 주소 (주석 처리됨)
    // const seoulApiUrl = 'https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseInformation/1.0?apikey=a6a8e58e-7215-4025-b453-2d33cdd09eb2';
    // const proxyUrl = `http://127.0.0.1:3001/?url=${encodeURIComponent(seoulApiUrl)}`;
    
    // [TEST MODE] 로컬 테스트용 Mock 데이터 주소
    const proxyUrl = 'js/seoul_spat_mock.json';
    
    async function fetchSpat() {
        try {
            const startTime = performance.now();
            const res = await fetch(proxyUrl);
            const endTime = performance.now();
            const resTime = endTime - startTime;
            if (!res.ok) throw new Error('Seoul API HTTP error');
            const data = await res.json();
            
            const dataArray = data.value || data; // OData 형식 대응
            const newMap = {};
            
            // [Mock Simulator for Demonstration]
            // SPaT 상태를 3초마다 랜덤하게 섞어주는 데모 시뮬레이터 (UI 정상 동작 확인용)
            const states = ['stop-And-Remain', 'protected-Movement-Allowed', 'protected-clearance'];
            dataArray.forEach(item => {
                const isMockSimulate = proxyUrl.includes('mock.json');
                
                if (isMockSimulate) {
                    ['nt', 'ne', 'et', 'se', 'st', 'sw', 'wt', 'nw'].forEach(dir => {
                        // 직진, 좌회전, 보행 상태를 각각 독립적으로 섞음
                        if (item[dir + 'StsgStatNm']) item[dir + 'StsgStatNm'] = states[Math.floor(Math.random() * states.length)];
                        if (item[dir + 'LtsgStatNm']) item[dir + 'LtsgStatNm'] = states[Math.floor(Math.random() * states.length)];
                        if (item[dir + 'PdsgStatNm']) item[dir + 'PdsgStatNm'] = states[Math.floor(Math.random() * 2) === 0 ? 0 : 1]; 
                    });
                }
                newMap[item.itstId] = item;
            });
            window.SEOUL_SPAT_MAP = newMap;
            window.SEOUL_SPAT_LAST_UPDATE = new Date();
            updateApiStatus('seoul', true, 'Connected', resTime);
            
            // 맵 마커 동적 업데이트 반영
            if (window.markers && window.markers.length > 0) {
                window.markers.forEach(m => {
                    const it = m.options.item;
                    if (it && it.isSeoul) {
                        const statInfo = getIntersectionStatusAndColor(it.itstId, it.isSeoul);
                        m.setStyle({
                            fillColor: statInfo.style.fillColor,
                            color: statInfo.style.color,
                            weight: statInfo.style.weight,
                            fillOpacity: statInfo.style.fillOpacity
                        });
                        it._statusInfo = statInfo;
                    }
                });
                updateStatusTable();
            }
        } catch (e) {
            console.error('Seoul SPAT Fetch Error:', e);
            updateApiStatus('seoul', false, 'Fetch Error');
        }
    }
    
    fetchSpat();
    // 일일 1,000건 제한을 고려하여 호출 주기를 약 87초(87000ms)로 연장 (24시간 내내 켜둘 경우)
    // 빠른 업데이트가 필요하면 필요에 따라 주기를 단축할 수 있습니다.
    setInterval(fetchSpat, 87000);
}
window.startSeoulSpatPolling = startSeoulSpatPolling;

window.UTIC_SPAT_MAP = {};
window.UTIC_SPAT_LAST_UPDATE = null;

async function startUticSpatPolling() {
    async function fetchUticSpat() {
        if (!currentRegionCode) return; // 지역 선택 안됐으면 대기
        try {
            const url = `${API_CONFIG.baseUrl.replace('getPlanCRRSInfo', 'getPlanCRSTInfo')}?type=json&srchCTId=${currentRegionCode}&pageNo=1&numOfRows=9999`;
            const startTime = performance.now();
            const res = await window.fetchData(url);
            const endTime = performance.now();
            
            if (!res.ok) throw new Error('UTIC SPAT HTTP error');
            const rawText = await res.text();
            let data;
            try {
                data = JSON.parse(rawText);
            } catch(e) { return; } // JSON 파싱 에러시 무시
            
            let rawItems = [];
            if (Array.isArray(data)) rawItems = data.slice(1);
            else if (data && data.body && data.body.items) rawItems = Array.isArray(data.body.items) ? data.body.items : [data.body.items];
            else if (data && data.items) rawItems = Array.isArray(data.items) ? data.items : [data.items];
            else if (data && data.PlanCRSTInfo) rawItems = Array.isArray(data.PlanCRSTInfo) ? data.PlanCRSTInfo : [data.PlanCRSTInfo];
            else if (data && data.response && data.response.body && data.response.body.items) {
                rawItems = Array.isArray(data.response.body.items) ? data.response.body.items : [data.response.body.items];
            }
            
            if (!rawItems || rawItems.length === 0) return;

            const newMap = {};
            rawItems.forEach(item => {
                const id = item.INT_NO || item.itstId;
                if (id) {
                    item.opMode = item.OP_MODE || '수신';
                    newMap[id] = item;
                }
            });
            window.UTIC_SPAT_MAP = newMap;
            window.UTIC_SPAT_LAST_UPDATE = new Date();
            updateApiStatus('utic', true, 'Connected', endTime - startTime);
            
            // 맵 마커 업데이트
            if (window.markers && window.markers.length > 0) {
                window.markers.forEach(m => {
                    const it = m.options.item;
                    if (it && !it.isSeoul) {
                        const statInfo = getIntersectionStatusAndColor(it.itstId, it.isSeoul);
                        
                        // 상태 색상이 이전과 다를 때만 캔버스 다시 그리기 (3000번 불필요한 렌더링 방지)
                        const prevColor = it._statusInfo ? it._statusInfo.style.fillColor : null;
                        if (prevColor !== statInfo.style.fillColor) {
                            m.setStyle({
                                fillColor: statInfo.style.fillColor,
                                color: statInfo.style.color,
                                weight: statInfo.style.weight,
                                fillOpacity: statInfo.style.fillOpacity
                            });
                            it._statusInfo = statInfo;
                            
                            // 사이드바 목록 트리 중 상태가 변한 것만 업데이트 (DOM 탐색 낭비 최소화)
                            const itemEl = document.querySelector(`.tree-item[data-id="${it.itstId}"] .status-dot`);
                            if (itemEl) {
                                const dotColor = statInfo.style.fillColor === 'transparent' ? statInfo.style.color : statInfo.style.fillColor;
                                itemEl.style.backgroundColor = dotColor;
                                itemEl.style.boxShadow = `0 0 8px ${dotColor}`;
                            }
                        }
                    }
                });
                updateStatusTable();
            }
        } catch (e) {
            console.error('UTIC SPAT Fetch Error:', e);
        }
    }
    
    // 3초 후 최초 실행, 60초 주기로 폴링 (API 한도 고려)
    setTimeout(() => {
        fetchUticSpat();
        setInterval(fetchUticSpat, 60000);
    }, 3000);
}
window.startUticSpatPolling = startUticSpatPolling;

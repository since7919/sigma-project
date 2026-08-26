const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/intersection_search.js', 'utf8');

const replacement = `
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
    
    let filtered = Object.values(junctions);
    let hasSearchResult = true;
    
    if (query) {
        filtered = filtered.filter(j => (j.name||'').toLowerCase().includes(query) || String(j.id).toLowerCase().includes(query));
        if (filtered.length === 0) hasSearchResult = false;
    }

    if (filtered.length === 0) {
        return hasSearchResult;
    }

    const grouped = {};
    filtered.forEach(j => {
        const rCode = getJunctionRegion(j);
        if (!grouped[rCode]) grouped[rCode] = [];
        grouped[rCode].push(j);
    });

    const regionCodes = Object.keys(grouped).sort((a,b) => (REGION_MAP[a]||a).localeCompare(REGION_MAP[b]||b, 'ko'));
    
    let currentTop = 0;
    
    regionCodes.forEach(rCode => {
        const rName = REGION_MAP[rCode] || rCode;
        const items = grouped[rCode].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
        const isOpen = query ? true : !!_openAccordions[rCode]; // 검색 중이면 모두 강제 열림
        
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
            html += \`
            <div class="acc-group" style="position:absolute; top:\${item.top}px; left:0; right:0; height:\${item.height}px; margin:0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div class="acc-header" onclick="toggleAccordion('\${item.rCode}')" style="height:100%; box-sizing:border-box; margin:0;">
                    <span class="acc-icon" style="width:20px;">\${item.isOpen ? '▼' : '▶'}</span>
                    \${item.rName} <span class="acc-count">(\${item.count})</span>
                </div>
            </div>\`;
        } else {
            const j = item.j;
            const isActive = activeJid === String(j.id);
            html += \`
            <div class="tree-item j-list-item \${isActive ? 'selected' : ''}" onclick="flyToIntersection('\${j.id}')" data-id="\${j.id}" style="position:absolute; top:\${item.top}px; left:0; right:0; height:\${item.height}px; box-sizing:border-box; margin:0;">
                <div class="status-dot" style="background: \${isActive ? '#38bdf8' : '#64748b'}; width:8px; height:8px; border-radius:50%; margin-right:8px; flex-shrink:0;"></div>
                <span style="color:#94a3b8; font-size:10px; margin-right:4px; flex-shrink:0;">[\${j.id}]</span> 
                <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">\${j.name || '-'}</span>
            </div>\`;
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
        listEl.innerHTML = \`
            <div style="padding:40px 20px; color:#666; font-size:12.5px; text-align:center;">
                <div style="margin-bottom:10px; font-size:24px; opacity:0.5;">🚫</div>
                표시할 교차로 데이터가 없습니다.<br>
                <div style="font-size:11px; color:#888; margin-top:8px;">(CSV 파일 로드 후 확인하세요)</div>
            </div>\`;
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
        noResultEl.innerHTML = \`
            <div style="margin-bottom:10px;">교차로 검색 결과가 없습니다.</div>
            <button class="btn-neon" onclick="searchAndMoveToLocation('\${query}')" style="width:100%; font-size:11px;">
                🌍 '\${query}' 장소 검색 (Enter)
            </button>
        \`;
        noResultEl.style.display = 'block';
    } else {
        if (noResultEl) noResultEl.style.display = 'none';
    }
}
`;

const startIndex = code.indexOf('function renderJunctionList() {');
const endIndexStr = 'let _placeSearchMarker = null;';
const endIndex = code.indexOf(endIndexStr);

if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + replacement + '\n' + code.substring(endIndex);
    fs.writeFileSync('SIGMA_SIM/js/intersection_search.js', code, 'utf8');
    console.log("Replaced renderJunctionList with virtual scrolling");
} else {
    console.log("Could not find targets");
}

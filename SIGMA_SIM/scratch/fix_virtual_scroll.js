const fs = require('fs');
const path = 'SIGMA_SIM/js/intersection_search.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

const target = `function buildVirtualListData() {
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
}`;

const replacement = `function buildVirtualListData() {
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
}`;

if (content.includes(target.replace(/\r\n/g, '\n'))) {
    content = content.replace(target.replace(/\r\n/g, '\n'), replacement.replace(/\r\n/g, '\n'));
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replacement successful.");
} else {
    console.log("Target not found!");
}

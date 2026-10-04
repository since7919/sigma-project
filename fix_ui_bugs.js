const fs = require('fs');

// 1. Restore original filters in index.html
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const originalFilters = `
<!-- [복구] 기존 통계 필터 -->
<div class="sigma-panel mb-20" style="background: rgba(255,255,255,0.03);">
    <div class="flex-row gap-20">
        <div style="flex: 1;">
            <div class="text-dim fs-11 mb-8">🏢 관리청(구청) 필터</div>
            <select id="stat-office-filter" onchange="renderStats()" class="tsd-select" style="width: 100%; height: 32px; background: rgba(0,0,0,0.4); color: #fff; border: 1px solid rgba(255,255,255,0.1);">
                <option value="ALL">전체 관리청</option>
            </select>
        </div>
        <div style="flex: 1;">
            <div class="text-dim fs-11 mb-8">👮 경찰서 필터</div>
            <select id="stat-police-filter" onchange="renderStats()" class="tsd-select" style="width: 100%; height: 32px; background: rgba(0,0,0,0.4); color: #fff; border: 1px solid rgba(255,255,255,0.1);">
                <option value="ALL">전체 경찰서</option>
            </select>
        </div>
        <div style="flex: 1;">
            <div class="text-dim fs-11 mb-8">⏱️ 시간대 필터</div>
            <select id="stat-time-filter" onchange="renderStats()" class="tsd-select" style="width: 100%; height: 32px; background: rgba(0,0,0,0.4); color: #fff; border: 1px solid rgba(255,255,255,0.1);">
                <option value="ALL">전체 (24시간)</option>
                <option value="AM_PEAK">오전 첨두 (07~09시)</option>
                <option value="PM_PEAK">오후 첨두 (17~19시)</option>
                <option value="NORMAL">비첨두 (09~17시)</option>
                <option value="NIGHT">심야 (20~06시)</option>
            </select>
        </div>
    </div>
</div>
`;

if (!html.includes('stat-office-filter')) {
    const aiBoxMarker = '<!-- [신규] AI 리포트 출력 및 설정 박스 -->';
    if (html.includes(aiBoxMarker)) {
        html = html.replace(aiBoxMarker, originalFilters + '\n                        ' + aiBoxMarker);
        fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
        console.log('Restored original filters to index.html');
    }
} else {
    console.log('Filters already exist.');
}

// 2. Fix data.js global state reference
let dataJs = fs.readFileSync('SIGMA_SIM/js/data.js', 'utf8');

if (dataJs.includes('window.STATE?.junctions')) {
    dataJs = dataJs.replace(/window\.STATE\?\.junctions/g, 'STATE.junctions');
    fs.writeFileSync('SIGMA_SIM/js/data.js', dataJs, 'utf8');
    console.log('Fixed STATE.junctions reference in data.js');
} else {
    console.log('window.STATE reference not found.');
}

var dashCharts = {};

console.log('SIGMA Dashboard module loaded.');

// Global Exports
window.openDashboard = openDashboard;
window.closeDashboard = closeDashboard;
window.sendToDashboard = sendToDashboard;

var dashPopup = null;

/**
 * 대시보드 열기 (새 브라우저 창)
 */
function openDashboard() {
    const windowName = "SIGMA_Dashboard";
    const windowFeatures = "width=1400,height=900,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes,popup=yes";

    // 이미 창이 열려있다면 포커스만 줌
    if (dashPopup && !dashPopup.closed) {
        dashPopup.focus();
    } else {
        dashPopup = window.open('dashboard.html', windowName, windowFeatures);
    }

    // 데이터 전송 (창이 로드될 시간 대기)
    setTimeout(sendToDashboard, 500);

    const btn = document.getElementById('btn-dashboard');
    if (btn) btn.classList.add('active');
}

/**
 * 대시보드 창으로 데이터 전송 (postMessage)
 */
function sendToDashboard() {
    if (!dashPopup || dashPopup.closed) {
        if (window.dashSyncInterval) {
            clearInterval(window.dashSyncInterval);
            window.dashSyncInterval = null;
        }
        const btn = document.getElementById('btn-dashboard');
        if (btn) btn.classList.remove('active');
        return;
    }

    // 전송할 데이터 구성
    const payload = {
        junctions: (typeof STATE !== 'undefined' && STATE.junctions) ?
            Object.keys(STATE.junctions).reduce((acc, jid) => {
                const j = STATE.junctions[jid];
                // 필요한 데이터만 골라서 전송 (함수 제외)
                acc[jid] = {
                    id: j.id,
                    name: j.name,
                    lat: j.lat,
                    lng: j.lng,
                    group: j.group,
                    opStats: j.opStats,
                    optimizerState: j.optimizerState,
                    schedules: j.schedules,
                    controller: j.controller,
                    movA: j.movA,
                    movB: j.movB,
                    signalMaps: j.signalMaps,
                    currentCycle: (typeof getCurrentOperatingCycle === 'function') ? getCurrentOperatingCycle(j) : 100
                };
                return acc;
            }, {}) : {},
        civilData: (typeof STATE !== 'undefined') ? STATE.civilData : [],
        // [New] 연동구간 정보 추가
        network: (typeof window.RoadManager !== 'undefined' && window.RoadManager.isActive) ? {
            edges: window.RoadManager.edges.map(pair => ({
                u_id: window.RoadManager.nodes[pair[0]].id,
                v_id: window.RoadManager.nodes[pair[1]].id
            })),
            baseWeight: window.RoadManager.baseWeight
        } : null,
        timestamp: Date.now()
    };

    dashPopup.postMessage({ type: 'SIGMA_DATA_UPDATE', payload: payload }, '*');
}

/**
 * 대시보드 닫기 (오버레이 호환성 유지)
 */
function closeDashboard() {
    if (dashPopup && !dashPopup.closed) {
        dashPopup.close();
    }
    const btn = document.getElementById('btn-dashboard');
    if (btn) btn.classList.remove('active');
}


/** 운영 현황 요약 렌더링 (대시보드용) */
function renderDashboardOpSummary(junctions) {
    const summaryEl = document.getElementById('dash-op-summary');
    if (!summaryEl) return;

    const jList = Object.values(junctions);
    const summaryData = {
        facilities: [
            { id: 1, label: "3지 교차로" }, { id: 2, label: "4지 교차로" },
            { id: 3, label: "5지 교차로" }, { id: 4, label: "6지 이상" },
            { id: 5, label: "어린이 보호구역" }, { id: 6, label: "노인 보호구역" }, { id: 7, label: "장애인 보호구역" },
            { id: 8, label: "대각선 횡단보도" }, { id: 10, label: "이단 횡단보도" }
        ],
        operations: [
            { id: 9, label: "동시보행 운영" }, { id: 11, label: "LPI 운영" },
            { label: "좌회전 감응", key: 'act_left' }, { label: "앞막힘 예방", key: 'act_grid' },
            { label: "보류/시차 운영", key: 'pedLagActive' },
            { id: 12, label: "항시/전일 점멸" }, { id: 13, label: "시간제 점멸" }
        ]
    };

    const counts = {};
    jList.forEach(j => {
        const stats = j.opStats || [];
        const opt = j.optimizerState || {};
        Object.values(summaryData).flat().forEach(item => {
            let active = false;
            if (item.id !== undefined) active = !!stats[item.id];
            else if (item.key) {
                if (item.key.startsWith('act_')) {
                    const k = item.key.split('_')[1];
                    active = Object.keys(opt).some(d => opt[d]?.op?.act?.[k]?.sType > 0);
                } else {
                    active = Object.keys(opt).some(d => opt[d]?.op?.[item.key]);
                }
            }
            if (active) counts[item.label] = (counts[item.label] || 0) + 1;
        });
    });

    const renderGroup = (title, items) => `
        <div style="flex: 1; min-width: 100px;">
            <div style="font-size:10px; color:rgba(255,255,255,0.3); font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">${title}</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${items.map(item => `
                    <div style="display:flex; justify-content:space-between; align-items: center; padding: 2px 0;">
                        <span style="color:rgba(255,255,255,0.5); font-size:11px;">${item.label}</span>
                        <span style="font-weight:700; color:#fff; font-size:12px;">${counts[item.label] || 0}<small style="font-weight:400; color:rgba(255,255,255,0.2); font-size:10px; margin-left:3px;">EA</small></span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // 데이터 분리하여 3열로 표시
    const group1 = summaryData.facilities.slice(0, 5);
    const group2 = summaryData.facilities.slice(5);
    const group3 = summaryData.operations;

    summaryEl.innerHTML = `
        ${renderGroup('Facilities 1', group1)}
        ${renderGroup('Facilities 2', group2)}
        ${renderGroup('Operations', group3)}
    `;
}

/**
 * 차트 초기화
 */
function initDashboardCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded.');
        return;
    }

    // Chart.js 전역 설정
    Chart.defaults.color = 'rgba(255, 255, 255, 0.6)';

    renderJunctionTypeChart();
    renderCivilDistChart();
    renderPerfRadarChart();

    // New Operational Statistics Charts
    renderDashboardHourlyAvgChart();
    renderDashboardCycleDistChart();
}

/** [New] 시간대별 평균 주기 차트 (평일/토요일/일요일 동시 표시) */
function renderDashboardHourlyAvgChart() {
    var canvas = document.getElementById('dash-chart-hourly-avg');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (dashCharts.hourly) dashCharts.hourly.destroy();

    var junctions = Object.values((typeof STATE !== 'undefined' && STATE.junctions) ? STATE.junctions : {});
    if (junctions.length === 0) return;

    var targetDays = [0, 2, 3]; // 평일, 토요일, 일요일
    var dayLabels = ["평일", "토요일", "일요일"];
    var dayColors = ["#f1c40f", "#e67e22", "#e84393"];

    var datasets = targetDays.map(function (dIdx, i) {
        var hourlyData = Array(24).fill(0);
        var hourlyCount = Array(24).fill(0);

        for (var h = 0; h < 24; h++) {
            var sec = h * 3600;
            junctions.forEach(function (j) {
                var sched = (j.group && STATE.groups[j.group]) ? STATE.groups[j.group].schedules[dIdx] : (j.schedules ? j.schedules[dIdx] : null);
                if (!sched) return;
                var activeIdx = 0, maxSec = -1;
                sched.forEach(function (sc, idx) {
                    if (sc && sc.h !== -1) {
                        var total = sc.h * 3600 + sc.m * 60;
                        if (sec >= total && total > maxSec) { maxSec = total; activeIdx = idx; }
                    }
                });
                var c = sched[activeIdx].cycle || 100;
                if (c > 0) { hourlyData[h] += c; hourlyCount[h]++; }
            });
        }

        var chartData = hourlyData.map(function (val, k) {
            return hourlyCount[k] > 0 ? Math.round(val / hourlyCount[k]) : 0;
        });

        return {
            label: dayLabels[i],
            data: chartData,
            borderColor: dayColors[i],
            backgroundColor: dayColors[i] + '22', // 22% opacity
            fill: false,
            tension: 0.4,
            pointRadius: 1,
            borderWidth: 2
        };
    });

    dashCharts.hourly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(24).fill(0).map(function (_, i) { return i + '시'; }),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    min: 60,
                    ticks: { color: '#888', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#888', font: { size: 10 } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#ccc', boxWidth: 10, font: { size: 10 } }
                }
            }
        }
    });
}

/** [New] 신호주기 분포도 (바 차트) */
function renderDashboardCycleDistChart() {
    var canvas = document.getElementById('dash-chart-cycle-dist');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (dashCharts.cycleDist) dashCharts.cycleDist.destroy();

    var hour = parseInt(document.getElementById('dash-hour-select')?.value) || 12;
    var junctions = Object.values((typeof STATE !== 'undefined' && STATE.junctions) ? STATE.junctions : {});

    var rangeLabels = [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
    var counts = Array(rangeLabels.length).fill(0);

    var targetSec = hour * 3600;
    junctions.forEach(function (j) {

        var sched = (j.group && STATE.groups[j.group]) ? STATE.groups[j.group].schedules[0] : j.schedules[0];
        if (!sched) return;
        var activeIdx = 0, maxSec = -1;
        sched.forEach(function (sc, idx) {
            if (sc && sc.h !== -1) {
                var total = sc.h * 3600 + sc.m * 60;
                if (targetSec >= total && total > maxSec) { maxSec = total; activeIdx = idx; }
            }
        });
        var c = sched[activeIdx].cycle || 100;
        var rIdx = rangeLabels.findIndex(r => c <= r);
        if (rIdx === -1) rIdx = rangeLabels.length - 1;
        counts[rIdx]++;
    });

    dashCharts.cycleDist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: rangeLabels.map(r => r + 's'),
            datasets: [{
                data: counts,
                backgroundColor: 'rgba(46, 204, 113, 0.5)',
                borderColor: '#2ecc71',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderJunctionTypeChart() {
    var canvas = document.getElementById('chart-junction-types');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (dashCharts.types) dashCharts.types.destroy();

    var stats = { '3지': 0, '4지': 0, '5지': 0, '6지+': 0, '단일': 0 };
    var junctions = (typeof STATE !== 'undefined' && STATE.junctions) ? STATE.junctions : {};

    Object.values(junctions).forEach(function (j) {
        const op = j.opStats || [];
        if (op[1]) stats['3지']++;
        else if (op[2]) stats['4지']++;
        else if (op[3]) stats['5지']++;
        else if (op[4]) stats['6지+']++;
        else if (op[0]) stats['단일']++;
        else stats['4지']++; // 기본값
    });

    dashCharts.types = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(stats),
            datasets: [{
                data: Object.values(stats),
                backgroundColor: [
                    'rgba(52, 152, 219, 0.7)',
                    'rgba(46, 204, 113, 0.7)',
                    'rgba(230, 126, 34, 0.7)',
                    'rgba(149, 165, 166, 0.7)'
                ],
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // 성능을 위해 애니메이션 비활성화 (필요 시 true)
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }
            },
            cutout: '70%'
        }
    });
}

function renderCivilDistChart() {
    var canvas = document.getElementById('chart-civil-dist');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (dashCharts.civil) dashCharts.civil.destroy();

    var labels = ['강남구', '서초구', '송파구', '강동구', '영등포구', '마포구'];
    var data = [42, 35, 28, 15, 33, 22];

    dashCharts.civil = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '민원 건수',
                data: data,
                backgroundColor: 'rgba(0, 212, 255, 0.4)',
                borderColor: '#00d4ff',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderPerfRadarChart() {
    var canvas = document.getElementById('chart-perf-radar');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (dashCharts.radar) dashCharts.radar.destroy();

    dashCharts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['처리 효율', '안정성', '응답 속도', '연동성', '데이터 정확도'],
            datasets: [{
                label: '현재 성능',
                data: [85, 92, 78, 88, 95],
                backgroundColor: 'rgba(155, 89, 182, 0.2)',
                borderColor: '#9b59b6',
                pointBackgroundColor: '#9b59b6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 9 } },
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function populateRecentTable() {
    var tbody = document.querySelector('#dash-recent-table tbody');
    if (!tbody) return;

    var civilEntries = (typeof STATE !== 'undefined' && STATE.civilData) ? STATE.civilData : [];

    // 데이터가 없는 경우 안내 메시지 표시
    if (civilEntries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#555;">로드된 민원 데이터가 없습니다.</td></tr>';
        return;
    }

    // 최신 순으로 정렬하여 상위 5개 추출
    var recent = civilEntries.slice(-5).reverse().map(function (c) {
        return {
            date: c['날짜'] || '-',
            police: c['경찰서'] || '-',
            system: c['시스템'] || '-',
            id: c['교차로번호'] || '-',
            name: c['교차로명'] || '-',
            fix: c['개선항목'] || '-'
        };
    });

    const recentRows = recent.map(r => ({
        cells: [
            { content: r.date, style: 'white-space:nowrap; color:#aaa;' },
            { content: r.police, style: 'white-space:nowrap;' },
            { content: r.system, style: 'white-space:nowrap;' },
            { content: r.id, style: 'font-weight:bold; color:var(--accent);' },
            { content: r.name },
            { content: r.fix, style: 'color:#bbb; font-size:9px;' }
        ]
    }));

    SigmaUI.renderTable('dash-recent-container', {
        tableId: 'dash-recent-table',
        className: 'sigma-table',
        head: ['날짜', '경찰서', '시스템', '교번', '교명', '개선항목'],
        rows: recentRows
    });
}

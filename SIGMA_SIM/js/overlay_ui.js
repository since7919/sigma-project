// overlay_ui.js
// 교차로 상세보기 창(Glassmorphism Overlay)의 순수 UI 조작(열기, 닫기, 탭 전환) 기능만 포함합니다.
// 실제 데이터 연동 로직은 기존 SIGMA_SIM의 연산 엔진과 별도로 연동하셔야 합니다.

let overlayMap = null;

function openDetailOverlay(jid) {
    if (!jid) {
        if (typeof STATE !== 'undefined' && STATE.activeJid) {
            jid = STATE.activeJid;
        } else {
            console.warn("열고자 하는 교차로 ID가 제공되지 않았습니다.");
            return;
        }
    }

    const modal = document.getElementById('detail-overlay-modal');
    const titleName = document.getElementById('overlay-title-name');
    const titleId = document.getElementById('overlay-title-id');
    
    // 교차로명 및 ID 세팅
    if (typeof STATE !== 'undefined' && STATE.junctions && STATE.junctions[jid]) {
        if(titleName) titleName.innerText = STATE.junctions[jid].name || '이름 없음';
        if(titleId) titleId.innerText = `ID: ${jid}`;
    } else {
        if(titleName) titleName.innerText = `교차로 상세`;
        if(titleId) titleId.innerText = `ID: ${jid}`;
    }

    // SIM 데이터 컨테이너를 모달 내부로 이동시켜 기존 렌더링 로직 유지 (Data Binding)
    const sigmapTab = document.getElementById('overlay-tab-sigmap');
    const sigmapContainer = document.getElementById('sigmap-table-container');

    if (sigmapContainer && !sigmapTab.contains(sigmapContainer)) {
        sigmapTab.appendChild(sigmapContainer);
    }

    modal.style.display = 'flex';
    
    // Google Satellite Map 초기화 및 이동
    if (!overlayMap) {
        overlayMap = L.map('overlay-leaflet-map', {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            touchZoom: false,
            doubleClickZoom: false,
            scrollWheelZoom: false,
            boxZoom: false,
            keyboard: false
        }).setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 18);
        L.tileLayer('https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 22
        }).addTo(overlayMap);
    } else {
        overlayMap.setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 18);
    }

    // 중앙 원형 마커 그리기 (API와의 완벽한 화면 싱크를 위해)
    if (window._overlayCenterMarker) {
        overlayMap.removeLayer(window._overlayCenterMarker);
    }
    window._overlayCenterMarker = L.circleMarker([STATE.junctions[jid].lat, STATE.junctions[jid].lng], {
        radius: 8,
        fillColor: '#00ecff',
        color: '#fff',
        weight: 2,
        fillOpacity: 0.8
    }).addTo(overlayMap);
    setTimeout(() => {
        if (overlayMap) {
            overlayMap.invalidateSize();
            if (typeof createOverlayArrows === 'function') {
                createOverlayArrows(jid, overlayMap);
                if (typeof updateSim === 'function') updateSim();
            }
        }
    }, 100);

    // 신호계획정보 탭(API UI) 렌더링
    if (typeof renderOverlayPlanInfo === 'function') {
        renderOverlayPlanInfo(jid);
    if (typeof renderBaseInfo === 'function') renderBaseInfo(jid);
    }
    
    // 상세보기 탭 버튼들 복원 및 optstats 탭 버튼 숨기기
    ['phase', 'sigmap', 'baseinfo'].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        if (btn) btn.style.display = '';
    });
    const optStatsBtn = document.getElementById('tab-btn-optstats');
    if (optStatsBtn) optStatsBtn.style.display = 'none';

    // 모달 열 때 기본 탭(신호계획정보) 활성화
    switchOverlayTab('phase');
    
    // 신호등 모드 버튼 초기화
    if (typeof updateOverlaySignalModeButton === 'function') {
        updateOverlaySignalModeButton();
    }

    // [추가] 상세보기 진입 시 현재 시간으로 동기화 및 1배속 자동 재생
    setTimeout(() => {
        const now = new Date();
        const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        
        if (typeof UI !== 'undefined' && UI.timeSlider) {
            UI.timeSlider.value = currentSeconds;
            UI.timeSlider.dispatchEvent(new Event('input'));
        }
        
        if (typeof setSpeed === 'function') {
            setSpeed(1);
        }
        
        if (typeof startSim === 'function' && typeof STATE !== 'undefined' && !STATE.simTimer) {
            startSim();
        }
    }, 200); // 맵/오버레이 초기화 대기 후 실행
}

function closeDetailOverlay() {
    document.getElementById('detail-overlay-modal').style.display = 'none';
}

function switchOverlayTab(tabName) {
    // 모든 탭 내용 숨기기
    document.querySelectorAll('.detail-tab-content').forEach(el => el.style.display = 'none');
    // 모든 탭 버튼 활성화 상태 제거
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // 선택한 탭 보이기 및 활성화
    const targetContent = document.getElementById(`overlay-tab-${tabName}`);
    if (targetContent) {
        if (tabName === 'phase') {
            targetContent.style.display = 'flex';
        } else {
            targetContent.style.display = 'block';
        }
    }
    
    const targetBtn = document.getElementById(`tab-btn-${tabName}`);
    if (targetBtn) targetBtn.classList.add('active');

    // 운영통계 탭일 때만 SVG 및 통계요약 보이기
    const svgArea = document.getElementById('overlay-svg-area');
    const summaryArea = document.getElementById('overlay-summary-area');
    if (svgArea) svgArea.style.display = (tabName === 'optstats') ? 'flex' : 'none';
    if (summaryArea) summaryArea.style.display = (tabName === 'optstats') ? 'flex' : 'none';
    
    setTimeout(() => {
        if (typeof overlayMap !== 'undefined' && overlayMap) {
            overlayMap.invalidateSize();
        }
    }, 300);
}
    }
    
    const pA = j._activePhaseA || 0;
    const pB = j._activePhaseB || 0;
    const rA = j._remainA || 0;
    const rB = j._remainB || 0;
    
    for (let i = 1; i <= 8; i++) {
        const box = document.getElementById(`phase-box-${i}`);
        const titleBar = document.getElementById(`phase-title-bar-${i}`);
        const titleTime = document.getElementById(`phase-title-time-${i}`);
        const labelA = document.getElementById(`phase-label-A-${i}`);
        const labelB = document.getElementById(`phase-label-B-${i}`);
        
        if (!box) continue;
        
        const isAActive = (pA === i && j._simCycle > 0);
        const isBActive = (pB === i && j._simCycle > 0);
        const isAnyActive = isAActive || isBActive;
        
        if (isAnyActive) {
            box.style.border = '2px solid #10b981';
            box.style.background = 'rgba(16, 185, 129, 0.1)';
            titleBar.style.background = '#10b981';
            titleBar.style.color = '#0f172a';
            
            let remainText = '';
            if (isAActive && isBActive) {
                remainText = (rA === rB) ? `${rA}s` : `A:${rA}s B:${rB}s`;
            } else if (isAActive) {
                remainText = `${rA}s`;
            } else if (isBActive) {
                remainText = `${rB}s`;
            }
            if (titleTime) {
                titleTime.style.display = 'inline-block';
                titleTime.innerText = remainText;
            }
        } else {
            const hasSplit = box.getAttribute('data-has-split') === 'true';
            box.style.border = hasSplit ? '1px solid #334155' : '1px solid #1e293b';
            box.style.background = 'rgba(255,255,255,0.02)';
            titleBar.style.background = '#1e293b';
            titleBar.style.color = '#cbd5e1';
            if (titleTime) titleTime.style.display = 'none';
        }
        
        if (labelA) labelA.style.color = isAActive ? '#10b981' : '#64748b';
        if (labelB) labelB.style.color = isBActive ? '#10b981' : '#64748b';
    }
}

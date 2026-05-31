/**
 * init.js
 * ─────────────────────────────────────────────
 * 애플리케이션 초기 설정 및 이벤트 리스너 통합
 * 의존: 모든 js 모듈
 */

window.addEventListener('DOMContentLoaded', () => {
    console.log("SIGMA - Initializing Application Entry Point...");

    // 1. UI 모듈 초기화
    if (typeof initPlanSelector === 'function') initPlanSelector();
    if (typeof initSidebarResizer === 'function') initSidebarResizer();
    if (typeof initGroupTabResizer === 'function') initGroupTabResizer();
    if (typeof initUIComponents === 'function') initUIComponents();
    if (typeof syncConfigEditUI === 'function') syncConfigEditUI();

    // 2. 지도 이벤트 핸들러 초기화
    if (typeof initMapClickHandlers === 'function') initMapClickHandlers();
    if (typeof initMapMoveHandlers === 'function') initMapMoveHandlers();

    // 3. 타임슬라이더 이벤트 연결
    if (UI.timeSlider) {
        UI.timeSlider.oninput = () => {
            updateSim();
            if (!STATE.simTimer && UI.stat) {
                UI.stat.innerText = "MANUAL";
                UI.stat.style.color = "var(--accent)";
            }
        };
    }

    // 4. 실시간 시계 업데이트 인터벌 (매초)
    setInterval(updateRealTime, 1000);
    updateRealTime(); // 즉시 실행
    
    // 4.1. 시뮬레이션 초기 요일 설정 (오늘 요일 기준)
    if (typeof setSimDay === 'function') setSimDay(new Date().getDay());

    // 5. 초기 테마 및 가시성 설정
    if (STATE.currentTheme === 'dark') {
        const btn = document.getElementById('btn-map-theme');
        if (btn) btn.classList.add('on');
    }

    // 6. 시작 시 현재 시간으로 점프 (선택 사항 - 여기서는 자동 실행)
    // goToCurrentTime();

    console.log("SIGMA - Entry Point Logic Connected.");

    // 강제로 초기 UI 공란 테이블 렌더링
    if (typeof deselectJunction === 'function') deselectJunction();
    if (typeof AppStateMachine !== 'undefined') AppStateMachine.updateGlobalUI(STATE.appMode);

    // [Intersection Search] auto_load.js에서 데이터 로드 완료 후 처리하도록 변경됨
    // if (typeof renderJunctionList === 'function') renderJunctionList();

    // [Auto Load Trigger]
    window.dispatchEvent(new CustomEvent('SIGMA_READY'));
});

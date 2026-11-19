/**
 * init.js
 * ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
 * ?�플리�??�션 초기 ?�정 �??�벤??리스???�합
 * ?�존: 모든 js 모듈
 */

window.addEventListener('DOMContentLoaded', () => {
    console.log("SIGMA - Initializing Application Entry Point...");

    // 1. UI 모듈 초기??
    if (typeof initPlanSelector === 'function') initPlanSelector();
    if (typeof initSidebarResizer === 'function') initSidebarResizer();
    if (typeof initGroupTabResizer === 'function') initGroupTabResizer();
    if (typeof initGroupDayDragAndDrop === 'function') initGroupDayDragAndDrop();
    if (typeof initUIComponents === 'function') initUIComponents();
    if (typeof syncConfigEditUI === 'function') syncConfigEditUI();
    if (typeof updateScales === 'function') updateScales();
    if (typeof initTimeSliderTicks === 'function') initTimeSliderTicks();

    // 2. 지???�벤???�들??초기??
    if (typeof initMapClickHandlers === 'function') initMapClickHandlers();
    if (typeof initMapMoveHandlers === 'function') initMapMoveHandlers();

    // 3. ?�?�슬?�이???�벤???�결
    if (UI.timeSlider) {
        UI.timeSlider.oninput = () => {
            if (typeof STATE !== 'undefined') STATE.isManualTimeMode = true;
            updateSim();
            if (!STATE.simTimer && UI.stat) {
                UI.stat.innerText = "MANUAL";
                UI.stat.style.color = "var(--accent)";
            }
        };
    }

    // 4. ?�시�??�계 ?�데?�트 ?�터�?(매초)
    setInterval(updateRealTime, 1000);
    updateRealTime(); // 즉시 ?�행
    
    // 4.1. ?��??�이??초기 ?�일 ?�정 (?�늘 ?�일 기�?)
    if (typeof setSimDay === 'function') setSimDay(new Date().getDay());

    // 5. 초기 ?�마 �?가?�성 ?�정
    if (STATE.currentTheme === 'dark') {
        const btn = document.getElementById('btn-map-theme');
        if (btn) btn.classList.add('on');
    }

    // 6. ?�작 ???�재 ?�간?�로 ?�프 (?�택 ?�항 - ?�기?�는 ?�동 ?�행)
    if (typeof goToCurrentTime === 'function') goToCurrentTime();

    // 7. Render 백엔???�버 ?�립 방�???Keep-Alive ??(1�?간격)
    setInterval(() => {
        fetch('/api/ping', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({}) })
            .catch(err => console.log('Keep-alive ping error:', err));
    }, 60000);

    console.log("SIGMA - Entry Point Logic Connected.");

    // 강제�?초기 UI 공�? ?�이�??�더�?
    if (typeof deselectJunction === 'function') deselectJunction();
    if (typeof AppStateMachine !== 'undefined') AppStateMachine.updateGlobalUI(STATE.appMode);

    // [Intersection Search] auto_load.js?�서 ?�이??로드 ?�료 ??처리?�도�?변경됨
    // if (typeof renderJunctionList === 'function') renderJunctionList();

    // [Auto Load Trigger]
    window.dispatchEvent(new CustomEvent('SIGMA_READY'));
});

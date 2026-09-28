/**
 * init.js
 * ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
 * ? í”Œë¦¬ì??´ì…˜ ì´ˆê¸° ?¤ì • ë°??´ë²¤??ë¦¬ìŠ¤???µí•©
 * ?˜ì¡´: ëª¨ë“  js ëª¨ë“ˆ
 */

window.addEventListener('DOMContentLoaded', () => {
    console.log("SIGMA - Initializing Application Entry Point...");

    // 1. UI ëª¨ë“ˆ ì´ˆê¸°??
    if (typeof initPlanSelector === 'function') initPlanSelector();
    if (typeof initSidebarResizer === 'function') initSidebarResizer();
    if (typeof initGroupTabResizer === 'function') initGroupTabResizer();
    if (typeof initGroupDayDragAndDrop === 'function') initGroupDayDragAndDrop();
    if (typeof initUIComponents === 'function') initUIComponents();
    if (typeof syncConfigEditUI === 'function') syncConfigEditUI();

    // 2. ì§€???´ë²¤???¸ë“¤??ì´ˆê¸°??
    if (typeof initMapClickHandlers === 'function') initMapClickHandlers();
    if (typeof initMapMoveHandlers === 'function') initMapMoveHandlers();

    // 3. ?€?„ìŠ¬?¼ì´???´ë²¤???°ê²°
    if (UI.timeSlider) {
        UI.timeSlider.oninput = () => {
            updateSim();
            if (!STATE.simTimer && UI.stat) {
                UI.stat.innerText = "MANUAL";
                UI.stat.style.color = "var(--accent)";
            }
        };
    }

    // 4. ?¤ì‹œê°??œê³„ ?…ë°?´íŠ¸ ?¸í„°ë²?(ë§¤ì´ˆ)
    setInterval(updateRealTime, 1000);
    updateRealTime(); // ì¦‰ì‹œ ?¤í–‰
    
    // 4.1. ?œë??ˆì´??ì´ˆê¸° ?”ì¼ ?¤ì • (?¤ëŠ˜ ?”ì¼ ê¸°ì?)
    if (typeof setSimDay === 'function') setSimDay(new Date().getDay());

    // 5. ì´ˆê¸° ?Œë§ˆ ë°?ê°€?œì„± ?¤ì •
    if (STATE.currentTheme === 'dark') {
        const btn = document.getElementById('btn-map-theme');
        if (btn) btn.classList.add('on');
    }

    // 6. ?œì‘ ???„ì¬ ?œê°„?¼ë¡œ ?í”„ (? íƒ ?¬í•­ - ?¬ê¸°?œëŠ” ?ë™ ?¤í–‰)
    // goToCurrentTime();

    // 7. Render ë°±ì—”???œë²„ ?¬ë¦½ ë°©ì???Keep-Alive ??(1ë¶?ê°„ê²©)
    setInterval(() => {
        fetch('/api/ping', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({}) })
            .catch(err => console.log('Keep-alive ping error:', err));
    }, 60000);

    console.log("SIGMA - Entry Point Logic Connected.");

    // ê°•ì œë¡?ì´ˆê¸° UI ê³µë? ?Œì´ë¸??Œë”ë§?
    if (typeof deselectJunction === 'function') deselectJunction();
    if (typeof AppStateMachine !== 'undefined') AppStateMachine.updateGlobalUI(STATE.appMode);

    // [Intersection Search] auto_load.js?ì„œ ?°ì´??ë¡œë“œ ?„ë£Œ ??ì²˜ë¦¬?˜ë„ë¡?ë³€ê²½ë¨
    // if (typeof renderJunctionList === 'function') renderJunctionList();

    // [Auto Load Trigger]
    window.dispatchEvent(new CustomEvent('SIGMA_READY'));
});

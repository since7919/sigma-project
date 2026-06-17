/**
 * security.js
 * ─────────────────────────────────────────────
 * 코드 보호 및 디버깅 방지 스크립트 (디버깅을 위해 일시 해제됨)
 */

(function () {
    /* 
    // 1. 우클릭 금지
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 2. 단축키 차단 (F12, Ctrl+Shift+I, J, C, S, U)
    document.addEventListener('keydown', e => {
        if (
            e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // Ctrl+Shift+I/J/C
            (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83)) // Ctrl+U (소스보기), Ctrl+S (저장)
        ) {
            e.preventDefault();
            return false;
        }
    });

    // 3. 디버거 감지 루프
    setInterval(function () {
        (function () {
            return false;
        })["constructor"]("debugger")["call"]();
    }, 1000);
    */

    console.log("%cSIGMA Debug Mode Enabled", "color: #f1c40f; font-weight: bold; font-size: 14px;");
})();

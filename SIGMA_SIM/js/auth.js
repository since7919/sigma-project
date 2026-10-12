/**
 * auth.js
 * ─────────────────────────────────────────────
 * 로그인 인증 및 세션 보안 관리 (국가정보보안기본지침 제53조 준수)
 */

// Simple obfuscated encryption for demo
const _k = [107, 111, 114, 111, 97, 100]; // "koroad"
const _p = [50, 53, 49, 50, 50, 55]; // "251227"

let _sessionIdleTimer = null;
const SESSION_IDLE_LIMIT = 15 * 60 * 1000; // 15분 유휴 제한 (국가정보보안기본지침 제53조 제3항)

function resetSessionIdleTimer() {
    if (_sessionIdleTimer) clearTimeout(_sessionIdleTimer);
    const overlay = document.getElementById('login-overlay');
    // 로그인 상태(오버레이가 숨겨진 상태)일 때만 유휴 타이머 작동
    if (overlay && overlay.style.display === 'none') {
        _sessionIdleTimer = setTimeout(() => {
            lockSessionDueToInactivity();
        }, SESSION_IDLE_LIMIT);
    }
}

function lockSessionDueToInactivity() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        const msg = document.getElementById('login-msg');
        if (msg) {
            msg.innerText = "보안 규정(제53조)에 따라 15분 이상 작업이 없어 세션이 자동 잠금되었습니다.";
            msg.style.opacity = '1';
        }
        const pwField = document.getElementById('login-pass');
        if (pwField) pwField.value = '';
        if (typeof pauseSim === 'function') pauseSim();
    }
}

// 사용자 조작 감지 시 유휴 타이머 리셋
['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetSessionIdleTimer, { passive: true });
});

function attemptLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const m = document.getElementById('login-msg');

    const uk = String.fromCharCode(..._k);
    const pk = String.fromCharCode(..._p);

    if (u === uk && p === pk) {
        const overlay = document.getElementById('login-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                resetSessionIdleTimer();
            }, 500);
        }
        if (m) m.style.opacity = '0';
        // Trigger init if needed
        if (typeof updateSim === 'function') updateSim();
    } else {
        if (m) {
            m.innerText = "아이디 또는 비밀번호가 올바르지 않습니다.";
            m.style.opacity = '1';
            setTimeout(() => m.style.opacity = '0', 3000);
        }
    }
}

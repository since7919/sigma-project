/**
 * auth.js
 * ─────────────────────────────────────────────
 * 로그인 인증 로직
 */

// Simple obfuscated encryption for demo
const _k = [107, 111, 114, 111, 97, 100]; // "koroad"
const _p = [50, 53, 49, 50, 50, 55]; // "251227"

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
            setTimeout(() => overlay.style.display = 'none', 500);
        }
        // Trigger init if needed
        if (typeof updateSim === 'function') updateSim();
    } else {
        if (m) {
            m.style.opacity = '1';
            setTimeout(() => m.style.opacity = '0', 3000);
        }
    }
}

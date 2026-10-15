/**
 * auth.js
 * ─────────────────────────────────────────────
 * 로그인 인증, 세션 보안 관리, 계정/비밀번호 복잡도 및 2FA 다중인증 통제
 * (국가정보보안기본지침 제53조, 제68조 준수)
 */

// 기본 계정 설정 (초기값: koroad / 251227)
const DEFAULT_USER = "koroad";
const DEFAULT_PASS = "251227";
const AUTH_STORAGE_KEY = "sigma_admin_auth_config";

let _sessionIdleTimer = null;
const SESSION_IDLE_LIMIT = 15 * 60 * 1000; // 15분 유휴 제한 (국가정보보안기본지침 제53조 제3항)

/** 저장된 인증 정보 조회 */
function getStoredAuth() {
    try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.user && parsed.pass) {
                return {
                    user: parsed.user,
                    pass: parsed.pass,
                    isDefault: false,
                    updatedAt: parsed.updatedAt || null,
                    mfaEnabled: !!parsed.mfaEnabled,
                    mfaPin: parsed.mfaPin || ""
                };
            }
        }
    } catch(e) {
        console.warn("[Auth] Failed to load custom credentials", e);
    }
    return {
        user: DEFAULT_USER,
        pass: DEFAULT_PASS,
        isDefault: true,
        updatedAt: null,
        mfaEnabled: false,
        mfaPin: ""
    };
}

/** 2FA 활성화 상태에 따른 로그인 창 PIN 입력란 동기화 */
function syncLoginMfaVisibility() {
    const auth = getStoredAuth();
    const mfaInput = document.getElementById('login-mfa');
    if (mfaInput) {
        if (auth.mfaEnabled && auth.mfaPin) {
            mfaInput.style.display = 'block';
        } else {
            mfaInput.style.display = 'none';
        }
    }
}

/** 비밀번호 복잡도 검증 (제53조 제2항: 9자 이상, 영문/숫자/특수문자 중 3종 이상) */
function validatePasswordComplexity(pw) {
    if (!pw || typeof pw !== 'string') {
        return { valid: false, msg: "비밀번호를 입력해 주세요." };
    }
    if (pw.length < 9) {
        return { valid: false, msg: "비밀번호는 최소 9자리 이상이어야 합니다. (국가정보보안지침 제53조)" };
    }
    let typesCount = 0;
    if (/[a-zA-Z]/.test(pw)) typesCount++;
    if (/[0-9]/.test(pw)) typesCount++;
    if (/[!@#$%^&*()_+~`\-={}\[\]:;"'<>,.?\/]/.test(pw)) typesCount++;

    if (typesCount < 3) {
        return { valid: false, msg: "영문, 숫자, 특수문자 중 3종류 이상을 반드시 조합해야 합니다." };
    }
    return { valid: true, msg: "안전한 비밀번호입니다." };
}

/** 유휴 세션 타이머 리셋 */
function resetSessionIdleTimer() {
    if (_sessionIdleTimer) clearTimeout(_sessionIdleTimer);
    const overlay = document.getElementById('login-overlay');
    // 로그인 잠금 화면이 닫혀 있을 때만 타이머 작동
    if (overlay && overlay.style.display === 'none') {
        _sessionIdleTimer = setTimeout(() => {
            lockSessionDueToInactivity();
        }, SESSION_IDLE_LIMIT);
    }
}

/** 유휴 시간 초과 시 자동 잠금 */
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
        const mfaField = document.getElementById('login-mfa');
        if (mfaField) mfaField.value = '';
        syncLoginMfaVisibility();
        if (typeof pauseSim === 'function') pauseSim();
    }
}

// 사용자 마우스/키보드 조작 감지 시 타이머 갱신
['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetSessionIdleTimer, { passive: true });
});

/** 로그인 및 세션 해제 시도 */
function attemptLogin() {
    const userEl = document.getElementById('login-user');
    const passEl = document.getElementById('login-pass');
    const mfaEl = document.getElementById('login-mfa');
    const msgEl = document.getElementById('login-msg');

    const u = (userEl ? userEl.value : '').trim();
    const p = (passEl ? passEl.value : '');
    const m = (mfaEl ? mfaEl.value : '').trim();

    const currentAuth = getStoredAuth();

    // 1차 ID/PW 검증
    if (u !== currentAuth.user || p !== currentAuth.pass) {
        if (msgEl) {
            msgEl.innerText = "아이디 또는 비밀번호가 올바르지 않습니다.";
            msgEl.style.opacity = '1';
            setTimeout(() => { if (msgEl) msgEl.style.opacity = '0'; }, 3000);
        }
        return;
    }

    // 2차 2FA 다중인증 검증 (국가정보보안기본지침 제68조)
    if (currentAuth.mfaEnabled && currentAuth.mfaPin) {
        if (!m || m !== currentAuth.mfaPin) {
            if (msgEl) {
                msgEl.innerText = "2차 인증(2FA PIN) 6자리가 올바르지 않습니다.";
                msgEl.style.opacity = '1';
                setTimeout(() => { if (msgEl) msgEl.style.opacity = '0'; }, 3000);
            }
            if (mfaEl) {
                mfaEl.style.display = 'block';
                mfaEl.focus();
            }
            return;
        }
    }

    // 로그인 성공
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            resetSessionIdleTimer();
        }, 400);
    }
    if (msgEl) msgEl.style.opacity = '0';
    if (typeof updateSim === 'function') updateSim();
}

/** 계정 및 비밀번호 설정/변경 모달 열기 */
function openPasswordChangeModal() {
    let modal = document.getElementById('pwd-change-modal');
    if (!modal) {
        createPasswordChangeModalDOM();
        modal = document.getElementById('pwd-change-modal');
    }
    const currentAuth = getStoredAuth();
    const userInput = document.getElementById('change-new-user');
    if (userInput) userInput.value = currentAuth.user;
    
    // 입력창 초기화
    const curPw = document.getElementById('change-cur-pass');
    const newPw = document.getElementById('change-new-pass');
    const confirmPw = document.getElementById('change-confirm-pass');
    const mfaChk = document.getElementById('change-enable-mfa');
    const mfaPinInput = document.getElementById('change-new-mfa');
    const statusMsg = document.getElementById('change-status-msg');

    if (curPw) curPw.value = '';
    if (newPw) newPw.value = '';
    if (confirmPw) confirmPw.value = '';
    if (mfaChk) mfaChk.checked = !!currentAuth.mfaEnabled;
    if (mfaPinInput) {
        mfaPinInput.value = currentAuth.mfaPin || '';
        mfaPinInput.disabled = !currentAuth.mfaEnabled;
    }

    if (statusMsg) {
        statusMsg.innerText = currentAuth.isDefault ? "현재 기본 계정(koroad)을 사용 중입니다. 보안을 위해 변경을 권장합니다." : "";
        statusMsg.style.color = currentAuth.isDefault ? "#38bdf8" : "#94a3b8";
    }

    if (modal) modal.style.display = 'flex';
}

/** 모달 닫기 */
function closePasswordChangeModal() {
    const modal = document.getElementById('pwd-change-modal');
    if (modal) modal.style.display = 'none';
}

/** 2FA 체크박스 토글 핸들러 */
function toggleMfaInput() {
    const chk = document.getElementById('change-enable-mfa');
    const pin = document.getElementById('change-new-mfa');
    if (chk && pin) {
        pin.disabled = !chk.checked;
        if (chk.checked) pin.focus();
    }
}

/** 비밀번호 및 보안 설정 변경 제출 */
function submitPasswordChange() {
    const curPw = (document.getElementById('change-cur-pass')?.value || '');
    const newU = (document.getElementById('change-new-user')?.value || '').trim();
    const newPw = (document.getElementById('change-new-pass')?.value || '');
    const confirmPw = (document.getElementById('change-confirm-pass')?.value || '');
    const mfaChk = document.getElementById('change-enable-mfa');
    const mfaPin = (document.getElementById('change-new-mfa')?.value || '').trim();
    const statusMsg = document.getElementById('change-status-msg');

    const showError = (msg) => {
        if (statusMsg) {
            statusMsg.innerText = "❌ " + msg;
            statusMsg.style.color = "#f87171";
        }
    };

    if (!newU) return showError("사용자 아이디(Username)를 입력해 주세요.");
    
    const currentAuth = getStoredAuth();
    if (curPw !== currentAuth.pass) {
        return showError("현재 비밀번호가 일치하지 않습니다.");
    }

    if (newPw !== confirmPw) {
        return showError("새 비밀번호 확인이 일치하지 않습니다.");
    }

    if (newPw === currentAuth.pass) {
        return showError("이전 비밀번호와 동일한 비밀번호는 재사용할 수 없습니다. (제53조)");
    }

    // 복잡도 검증
    const complexity = validatePasswordComplexity(newPw);
    if (!complexity.valid) {
        return showError(complexity.msg);
    }

    // 2FA 검증 (체크된 경우 6자리 숫자 필수)
    let isMfa = mfaChk ? mfaChk.checked : false;
    if (isMfa) {
        if (!/^\d{6}$/.test(mfaPin)) {
            return showError("2FA 2차 인증 PIN은 숫자 6자리로 입력해야 합니다. (제68조)");
        }
    }

    // 저장
    const newAuth = {
        user: newU,
        pass: newPw,
        isDefault: false,
        updatedAt: new Date().toISOString(),
        mfaEnabled: isMfa,
        mfaPin: isMfa ? mfaPin : ""
    };
    try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuth));
    } catch(e) {
        return showError("저장 실패: 브라우저 저장소 오류");
    }

    // 성공 처리
    alert("보안 계정 정보 및 다중인증 설정이 저장되었습니다.\n새로운 계정 정보로 로그인해 주세요.");
    closePasswordChangeModal();

    // 잠금 화면 필드 동기화
    const uField = document.getElementById('login-user');
    const pField = document.getElementById('login-pass');
    const mField = document.getElementById('login-mfa');
    if (uField) uField.value = newU;
    if (pField) pField.value = '';
    if (mField) mField.value = '';
    syncLoginMfaVisibility();
}

/** 비밀번호 변경 모달 DOM 동적 생성 */
function createPasswordChangeModalDOM() {
    if (document.getElementById('pwd-change-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'pwd-change-modal';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(11,15,25,0.85); backdrop-filter:blur(10px); z-index:9999999; align-items:center; justify-content:center;';

    modal.innerHTML = `
        <div style="background:#0f172a; border:1px solid rgba(56,189,248,0.3); border-radius:16px; padding:28px; width:460px; max-width:92vw; box-shadow:0 20px 50px rgba(0,0,0,0.6); color:#cbd5e1; font-family:'Pretendard',sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#38bdf8; font-size:18px;"><i class="fa-solid fa-shield-halved"></i></span>
                    <h3 style="font-size:16px; font-weight:700; color:#f8fafc; margin:0;">계정 보안 및 2FA 다중인증 설정</h3>
                </div>
                <button onclick="closePasswordChangeModal()" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer;">✕</button>
            </div>
            
            <p style="font-size:11px; color:#94a3b8; margin-bottom:16px; line-height:1.5;">
                국가정보보안기본지침 제53조/제68조에 따라 <strong style="color:#38bdf8;">최소 9자리 이상</strong>, <strong>영문/숫자/특수문자 3종 이상 조합</strong> 및 <strong>원격 다중인증(2FA)</strong>을 지원합니다.
            </p>

            <div style="display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">현재 비밀번호</label>
                    <input type="password" id="change-cur-pass" placeholder="현재 비밀번호 (기본: 251227)" style="width:100%; box-sizing:border-box; padding:9px 12px; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:12px; outline:none;">
                </div>
                <div>
                    <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">사용자 아이디 (Username)</label>
                    <input type="text" id="change-new-user" placeholder="새 사용자 아이디" style="width:100%; box-sizing:border-box; padding:9px 12px; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:12px; outline:none;">
                </div>
                <div>
                    <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">새 비밀번호 (9자 이상 + 영문/숫자/특수문자 조합)</label>
                    <input type="password" id="change-new-pass" placeholder="새 비밀번호 입력" style="width:100%; box-sizing:border-box; padding:9px 12px; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:12px; outline:none;">
                </div>
                <div>
                    <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">새 비밀번호 확인</label>
                    <input type="password" id="change-confirm-pass" placeholder="새 비밀번호 재입력" style="width:100%; box-sizing:border-box; padding:9px 12px; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:12px; outline:none;">
                </div>
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:11px; font-weight:600; color:#38bdf8;"><i class="fa-solid fa-lock"></i> 2차 다중인증 (2FA, 제68조)</span>
                        <label style="font-size:11px; color:#94a3b8; cursor:pointer; display:flex; align-items:center; gap:5px;">
                            <input type="checkbox" id="change-enable-mfa" onchange="toggleMfaInput()"> 2FA 활성화
                        </label>
                    </div>
                    <input type="password" id="change-new-mfa" maxlength="6" disabled placeholder="2FA 6자리 숫자 PIN 입력 (미사용 시 비활성)" style="width:100%; box-sizing:border-box; padding:9px 12px; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:12px; outline:none;">
                </div>
            </div>

            <div id="change-status-msg" style="font-size:11px; margin-top:12px; min-height:16px;"></div>

            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:18px;">
                <button onclick="closePasswordChangeModal()" style="padding:8px 16px; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#cbd5e1; font-size:12px; cursor:pointer;">취소</button>
                <button onclick="submitPasswordChange()" style="padding:8px 20px; border-radius:8px; background:#0284c7; hover:bg:#0369a1; border:none; color:#fff; font-size:12px; font-weight:700; cursor:pointer;">설정 및 저장</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// 초기 로딩 시 2FA 입력란 표시 여부 동기화
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncLoginMfaVisibility);
    } else {
        syncLoginMfaVisibility();
    }
}

// Global Exports
window.attemptLogin = attemptLogin;
window.resetSessionIdleTimer = resetSessionIdleTimer;
window.openPasswordChangeModal = openPasswordChangeModal;
window.closePasswordChangeModal = closePasswordChangeModal;
window.submitPasswordChange = submitPasswordChange;
window.validatePasswordComplexity = validatePasswordComplexity;
window.toggleMfaInput = toggleMfaInput;

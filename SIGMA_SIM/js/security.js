/**
 * security.js
 * ─────────────────────────────────────────────
 * 클라이언트 런타임 보안 및 중요 정보 노출 방지 (행안부 SW 개발보안 가이드 6.1.1 준수)
 */

(function () {
    // 프로덕션 환경에서 중요 API 키 및 토큰의 평문 콘솔 출력 마스킹/필터링
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const _origLog = console.log;
        const _origWarn = console.warn;
        const _origInfo = console.info;

        const maskSensitive = (args) => {
            return args.map(arg => {
                if (typeof arg === 'string') {
                    return arg.replace(/(eyJh[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g, '[REDACTED_JWT]')
                              .replace(/(service_role_[a-zA-Z0-9_-]+)/gi, '[REDACTED_SECRET]')
                              .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '[REDACTED_EMAIL]');
                }
                return arg;
            });
        };

        console.log = function (...args) { _origLog.apply(console, maskSensitive(args)); };
        console.warn = function (...args) { _origWarn.apply(console, maskSensitive(args)); };
        console.info = function (...args) { _origInfo.apply(console, maskSensitive(args)); };
    }
})();

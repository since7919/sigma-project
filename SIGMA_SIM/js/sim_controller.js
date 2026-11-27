/**
 * SIGMA_SIM - Simulation Controller Module (sim_controller.js)
 * ══════════════════════════════════════════════════════════════════════════
 * 하단 신호 시뮬레이터 플로팅 제어 바(Floating Control Bar) 전용 독립 모듈
 * 
 * [주요 책임]
 * 1. 시뮬레이터 UI 마크업 렌더링 및 동적 주입 (DOM Injection)
 * 2. 24시간 타임라인 슬라이더, 1시간 단위 눈금선(Tick Marks) 렌더링
 * 3. 정각 자석 스냅(Magnetic Snap-to-Hour) 및 실시간(NOW) 동기화
 * 4. 재생/일시정지, 배속 선택 세그먼트, 화살표 크기 조절 컨트롤
 * 5. UI 객체(UI.clock, UI.timeSlider, UI.stat 등) 포인터 바인딩 및 상태 피드백
 * ══════════════════════════════════════════════════════════════════════════
 */

(function (window) {
    'use strict';

    console.log('[SimController] Initializing Simulation Controller Module...');

    // ──────────────────────────────────────────────────────────
    // 1. 시뮬레이터 마크업 템플릿
    // ──────────────────────────────────────────────────────────
    function getSimulatorMarkup() {
        return `
    <div class="controls minimized" id="sim-controls">
        <button id="btn-toggle-controls" class="btn-toggle-controls" onclick="toggleControls()" title="신호 시뮬레이터 표시/숨기기">
            <span class="handle-icon">🚦</span>
            <span class="handle-text-bottom">신호 시뮬레이터</span>
        </button>
        <div class="flex-row-between">
            <div class="flex-row gap-15" style="align-items: baseline;">
                <div id="clock" class="fs-72 text-accent"
                    style="font-family: monospace; font-weight: 900; line-height: 1; text-shadow: 0 0 20px var(--accent-glow);">
                    00:00:00</div>
                <div id="real-time-display" class="real-time-badge" onclick="goToCurrentTime()" title="현재 시간으로 이동">
                    <span class="recording-dot"></span>
                    NOW: 00:00:00
                </div>
                <div class="sim-day-selector">
                    <button class="btn-day active" data-day="1" onclick="setSimDay(1)">월</button>
                    <button class="btn-day" data-day="2" onclick="setSimDay(2)">화</button>
                    <button class="btn-day" data-day="3" onclick="setSimDay(3)">수</button>
                    <button class="btn-day" data-day="4" onclick="setSimDay(4)">목</button>
                    <button class="btn-day" data-day="5" onclick="setSimDay(5)">금</button>
                    <button class="btn-day" data-day="6" onclick="setSimDay(6)">토</button>
                    <button class="btn-day" data-day="0" onclick="setSimDay(0)">일</button>
                </div>
            </div>
            <div id="sim-speed-display" class="fs-14 text-accent fw-800">SPEED: 4x (Normal)</div>
        </div>

        <div class="time-slider-container" id="timeSliderContainer">
            <div class="time-ticks" id="timeTicks">
                <!-- 0시 ~ 24시 1시간 단위 눈금선 (25개) -->
                <div class="time-tick major" data-hour="0" style="left: 0%;" title="00:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="1" style="left: 4.1667%;" title="01:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="2" style="left: 8.3333%;" title="02:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick major" data-hour="3" style="left: 12.5%;" title="03:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="4" style="left: 16.6667%;" title="04:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="5" style="left: 20.8333%;" title="05:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick major" data-hour="6" style="left: 25%;" title="06:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="7" style="left: 29.1667%;" title="07:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="8" style="left: 33.3333%;" title="08:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick major" data-hour="9" style="left: 37.5%;" title="09:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="10" style="left: 41.6667%;" title="10:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="11" style="left: 45.8333%;" title="11:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick major" data-hour="12" style="left: 50%;" title="12:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="13" style="left: 54.1667%;" title="13:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="14" style="left: 58.3333%;" title="14:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick major" data-hour="15" style="left: 62.5%;" title="15:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="16" style="left: 66.6667%;" title="16:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="17" style="left: 70.8333%;" title="17:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick major" data-hour="18" style="left: 75%;" title="18:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="19" style="left: 79.1667%;" title="19:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="20" style="left: 83.3333%;" title="20:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick major" data-hour="21" style="left: 87.5%;" title="21:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="22" style="left: 91.6667%;" title="22:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick minor" data-hour="23" style="left: 95.8333%;" title="23:00 (클릭 시 정각 이동)"></div>
                <div class="time-tick major" data-hour="24" style="left: 100%;" title="24:00 (클릭 시 정각 이동)"></div>
            </div>
            <div class="time-labels">
                <span style="left: 0%;">00:00</span>
                <span style="left: 12.5%;">03:00</span>
                <span style="left: 25%;">06:00</span>
                <span style="left: 37.5%;">09:00</span>
                <span style="left: 50%;">12:00</span>
                <span style="left: 62.5%;">15:00</span>
                <span style="left: 75%;">18:00</span>
                <span style="left: 87.5%;">21:00</span>
                <span style="left: 100%;">24:00</span>
            </div>
            <input type="range" id="timeSlider" min="0" max="86399" value="25200" class="sim-range">
            <div id="real-time-marker" class="time-marker"></div>
        </div>

        <div class="sim-btn-group">
            <!-- 1. 재생 및 타임스킵 컨트롤 그룹 -->
            <div class="sim-control-cluster play-cluster">
                <button class="btn-play" id="btn-play-pause" onclick="toggleSim()">▶ PLAY</button>
                <div class="btn-split-group">
                    <button class="btn-sim-tool" onclick="skipTime(-10)" title="10초 뒤로">⏪ -10s</button>
                    <button class="btn-sim-tool" onclick="skipTime(10)" title="10초 앞으로">+10s ⏩</button>
                </div>
            </div>

            <!-- 세로 구분선 -->
            <div class="sim-v-divider"></div>

            <!-- 2. 배속 선택 세그먼트 그룹 -->
            <div class="sim-control-cluster speed-cluster" title="시뮬레이션 배속 설정">
                <span class="cluster-label">배속</span>
                <div class="sim-segmented-box">
                    <button class="btn-speed" id="sp-1" onclick="setSpeed(1)">1.0x</button>
                    <button class="btn-speed active" id="sp-4" onclick="setSpeed(4)">4.0x</button>
                    <button class="btn-speed" id="sp-8" onclick="setSpeed(8)">8.0x</button>
                </div>
            </div>

            <!-- 세로 구분선 -->
            <div class="sim-v-divider"></div>

            <!-- 3. 신호화살표 크기 조절 컨트롤 그룹 -->
            <div class="sim-scale-group" id="sim-arrow-scale-box" title="신호 화살표 및 신호등 크기 조절">
                <span class="cluster-label">
                    <span style="font-size: 13px;">🏹</span> 화살표 크기
                </span>
                <button class="btn-scale-step" onclick="adjustSimArrowScale(-0.1)" title="화살표 축소 (0.1 감소)">➖</button>
                <div class="scale-slider-wrap">
                    <input type="range" id="sim-arrow-scale-range" min="0.5" max="2.5" step="0.1" value="1.5" 
                           oninput="onSimArrowScaleChange(this.value)">
                    <span id="sim-arrow-scale-text">1.5x</span>
                </div>
                <button class="btn-scale-step" onclick="adjustSimArrowScale(0.1)" title="화살표 확대 (0.1 증가)">➕</button>
                <div class="scale-preset-group">
                    <button class="btn-arrow-scale-preset" data-scale="0.8" onclick="setSimArrowScale(0.8)" title="작게 (0.8x)">작게</button>
                    <button class="btn-arrow-scale-preset active" data-scale="1.5" onclick="setSimArrowScale(1.5)" title="보통 (1.5x)">보통</button>
                    <button class="btn-arrow-scale-preset" data-scale="2.2" onclick="setSimArrowScale(2.2)" title="크게 (2.2x)">크게</button>
                </div>
            </div>

            <!-- 4. 상태 표시 칩 (우측 정렬) -->
            <div id="stat" class="sim-status-chip">READY</div>
        </div>
    </div>`;
    }

    // ──────────────────────────────────────────────────────────
    // 2. UI 마크업 주입 및 바인딩
    // ──────────────────────────────────────────────────────────
    function injectSimulatorUI() {
        if (document.getElementById('sim-controls')) {
            // 이미 마크업이 존재하면 포인터 및 이벤트만 갱신
            bindUIPointers();
            initTimeSliderTicks();
            return;
        }

        const targetContainer = document.getElementById('sim-controls-container') || document.body;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = getSimulatorMarkup();
        const el = wrapper.firstElementChild;
        targetContainer.appendChild(el);

        bindUIPointers();
        initTimeSliderTicks();
        console.log('[SimController] Simulator UI successfully injected.');
    }

    function bindUIPointers() {
        if (typeof window.UI === 'undefined') {
            window.UI = {};
        }
        window.UI.clock = document.getElementById('clock');
        window.UI.timeSlider = document.getElementById('timeSlider');
        window.UI.stat = document.getElementById('stat');
        window.UI.simSpeed = document.getElementById('sim-speed-display');
        
        // 전역 UI 객체(스코프 내 UI 변수 포함) 동기화 보장
        if (typeof UI !== 'undefined') {
            UI.clock = window.UI.clock;
            UI.timeSlider = window.UI.timeSlider;
            UI.stat = window.UI.stat;
            UI.simSpeed = window.UI.simSpeed;
        }

        // 슬라이더 조작 시 수동 시간 모드 설정
        if (window.UI.timeSlider) {
            window.UI.timeSlider.oninput = () => {
                if (typeof window.STATE !== 'undefined') window.STATE.isManualTimeMode = true;
                if (typeof window.updateSim === 'function') window.updateSim();
                if (window.STATE && !window.STATE.simTimer && window.UI.stat) {
                    window.UI.stat.innerText = "MANUAL";
                    window.UI.stat.style.color = "var(--accent)";
                }
            };
        }
    }

    // ──────────────────────────────────────────────────────────
    // 3. 컨트롤러 펼침/숨김 토글
    // ──────────────────────────────────────────────────────────
    function toggleControls() {
        const controls = document.getElementById('sim-controls');
        const btn = document.getElementById('btn-toggle-controls');
        if (!controls || !btn) return;

        controls.classList.toggle('minimized');
        const isMinimized = controls.classList.contains('minimized');

        if (isMinimized) {
            btn.innerHTML = '<span class="handle-icon">🚦</span><span class="handle-text-bottom">신호 시뮬레이터</span>';
            btn.title = "신호 시뮬레이터 펼치기";
            if (window.STATE && window.STATE.showSignalArrows) {
                if (typeof window.toggleSignalMode === 'function') window.toggleSignalMode();
            }
        } else {
            btn.innerHTML = '<span class="handle-icon">▼</span><span class="handle-text-bottom">시뮬레이터 숨기기</span>';
            btn.title = "시뮬레이터 숨기기";
            // 신호시뮬레이터를 열면 실행 시점의 현재 시간(now)으로 설정
            if (typeof window.STATE !== 'undefined') window.STATE.isManualTimeMode = false;
            if (typeof window.goToCurrentTime === 'function') window.goToCurrentTime();
            if (window.STATE && !window.STATE.showSignalArrows) {
                if (typeof window.toggleSignalMode === 'function') window.toggleSignalMode();
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    // 4. 화살표/신호등 크기 제어 및 동기화
    // ──────────────────────────────────────────────────────────
    function syncScaleArrow(val) {
        if (typeof window.STATE === 'undefined') return;

        if (val !== undefined) {
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) {
                window.STATE.arrowScale = Math.max(0.4, Math.min(3.0, Math.round(parsed * 10) / 10));
            }
        } else {
            window.STATE.arrowScale = window.STATE.arrowScale || 1.5;
        }

        const currentScale = window.STATE.arrowScale;

        // 1. 전역 CSS 변수 갱신 (GPU 가속 스케일링)
        document.documentElement.style.setProperty('--arrow-scale', currentScale);

        // 2. 하단 시뮬레이터 컨트롤 바 실시간 동기화
        const simRange = document.getElementById('sim-arrow-scale-range');
        const simText = document.getElementById('sim-arrow-scale-text');
        if (simRange) simRange.value = currentScale;
        if (simText) simText.innerText = currentScale.toFixed(1) + 'x';

        // 3. 하단 프리셋 버튼 active 상태 동기화
        document.querySelectorAll('.btn-arrow-scale-preset').forEach(btn => {
            const presetVal = parseFloat(btn.getAttribute('data-scale'));
            btn.classList.toggle('active', Math.abs(presetVal - currentScale) < 0.05);
        });

        // 4. 좌측 사이드바 '신호등 크기' 슬라이더 동기화
        const valSpan = document.getElementById('val-arrow-size-bottom');
        if (valSpan) {
            const labels = ['작게', '보통', '크게'];
            let step = 1;
            if (currentScale <= 1.0) step = 0;
            else if (currentScale >= 2.0) step = 2;
            valSpan.innerText = labels[step];

            document.querySelectorAll('.step-slider').forEach(container => {
                const onclickAttr = container.getAttribute('onclick') || '';
                if (onclickAttr.includes("'arrow'") && typeof window.updateStepSliderUI === 'function') {
                    window.updateStepSliderUI(container, step);
                }
            });
        }

        // 5. 로컬 스토리지에 영구 저장
        try {
            localStorage.setItem('sigma_arrow_scale', currentScale);
        } catch (e) {
            console.warn('[SimController] Failed to persist arrow scale:', e);
        }
    }

    function setSimArrowScale(val) {
        syncScaleArrow(val);
    }

    function adjustSimArrowScale(delta) {
        const cur = (typeof window.STATE !== 'undefined' && window.STATE.arrowScale) ? window.STATE.arrowScale : 1.5;
        syncScaleArrow(cur + delta);
    }

    function onSimArrowScaleChange(val) {
        syncScaleArrow(val);
    }

    // ──────────────────────────────────────────────────────────
    // 5. 타임라인 1시간 눈금 및 정각 자석 스냅(Magnetic Snap)
    // ──────────────────────────────────────────────────────────
    function renderTimeTicks() {
        const ticksContainer = document.getElementById('timeTicks');
        if (!ticksContainer) return;

        if (ticksContainer.children.length === 0) {
            let html = '';
            for (let h = 0; h <= 24; h++) {
                const isMajor = (h % 3 === 0);
                const pct = (h / 24 * 100).toFixed(4);
                const cls = isMajor ? 'time-tick major' : 'time-tick minor';
                const title = `${String(h).padStart(2, '0')}:00 (클릭 시 정각 이동)`;
                html += `<div class="${cls}" data-hour="${h}" style="left: ${pct}%;" title="${title}"></div>`;
            }
            ticksContainer.innerHTML = html;
        }

        ticksContainer.querySelectorAll('.time-tick').forEach(tick => {
            tick.onclick = (e) => {
                e.stopPropagation();
                const h = parseInt(tick.getAttribute('data-hour'), 10);
                if (!isNaN(h)) {
                    snapTimeSliderToHour(h, true);
                }
            };
        });
    }

    function snapTimeSliderToHour(hour, showFeedback = true) {
        if (typeof window.STATE !== 'undefined') window.STATE.isManualTimeMode = true;
        const slider = (typeof window.UI !== 'undefined' && window.UI.timeSlider) ? window.UI.timeSlider : document.getElementById('timeSlider');
        if (!slider) return;
        const targetSec = (hour >= 24) ? 86399 : Math.max(0, Math.floor(hour * 3600));
        slider.value = targetSec;

        if (typeof window.updateSim === 'function') {
            window.updateSim();
        }

        if (showFeedback) {
            const clock = (typeof window.UI !== 'undefined' && window.UI.clock) ? window.UI.clock : document.getElementById('clock');
            if (clock) {
                clock.classList.remove('snap-pulse');
                void clock.offsetWidth;
                clock.classList.add('snap-pulse');
            }

            const stat = (typeof window.UI !== 'undefined' && window.UI.stat) ? window.UI.stat : document.getElementById('stat');
            if (stat) {
                const hStr = String(hour >= 24 ? 24 : hour).padStart(2, '0');
                stat.innerText = `⏱ ${hStr}:00 정각 스냅`;
                stat.style.color = '#38bdf8';

                clearTimeout(window._snapFeedbackTimer);
                window._snapFeedbackTimer = setTimeout(() => {
                    if (typeof window.STATE !== 'undefined' && !window.STATE.simTimer) {
                        stat.innerText = "MANUAL";
                        stat.style.color = "var(--accent)";
                    } else {
                        stat.innerText = "RUNNING";
                        stat.style.color = "var(--accent)";
                    }
                }, 1200);
            }
        }
    }

    function checkAndSnapTimeSlider(thresholdSec = 900) {
        const slider = (typeof window.UI !== 'undefined' && window.UI.timeSlider) ? window.UI.timeSlider : document.getElementById('timeSlider');
        if (!slider) return false;
        const curSec = parseInt(slider.value, 10);
        if (isNaN(curSec)) return false;

        const nearestHour = Math.round(curSec / 3600);
        const nearestSec = (nearestHour >= 24) ? 86399 : (nearestHour * 3600);
        const diff = Math.abs(curSec - nearestSec);

        if (diff > 0 && diff <= thresholdSec) {
            snapTimeSliderToHour(nearestHour, true);
            return true;
        }
        return false;
    }

    function initTimeSliderTicks() {
        renderTimeTicks();

        const slider = (typeof window.UI !== 'undefined' && window.UI.timeSlider) ? window.UI.timeSlider : document.getElementById('timeSlider');
        if (slider) {
            slider.addEventListener('change', () => {
                checkAndSnapTimeSlider(900);
            });

            slider.addEventListener('pointerup', () => {
                setTimeout(() => {
                    checkAndSnapTimeSlider(900);
                }, 10);
            });

            const container = document.getElementById('timeSliderContainer');
            if (container) {
                container.addEventListener('click', () => {
                    setTimeout(() => {
                        checkAndSnapTimeSlider(900);
                    }, 50);
                });
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    // 6. 전역 노출 및 초기화
    // ──────────────────────────────────────────────────────────
    window.SimController = {
        injectSimulatorUI,
        bindUIPointers,
        toggleControls,
        syncScaleArrow,
        setSimArrowScale,
        adjustSimArrowScale,
        onSimArrowScaleChange,
        renderTimeTicks,
        snapTimeSliderToHour,
        checkAndSnapTimeSlider,
        initTimeSliderTicks
    };

    // 하위 호환성을 위한 전역 함수 등록
    window.toggleControls = toggleControls;
    window.syncScaleArrow = syncScaleArrow;
    window.setSimArrowScale = setSimArrowScale;
    window.adjustSimArrowScale = adjustSimArrowScale;
    window.onSimArrowScaleChange = onSimArrowScaleChange;
    window.renderTimeTicks = renderTimeTicks;
    window.snapTimeSliderToHour = snapTimeSliderToHour;
    window.checkAndSnapTimeSlider = checkAndSnapTimeSlider;
    window.initTimeSliderTicks = initTimeSliderTicks;

    // DOM 로드 즉시 주입 및 바인딩
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSimulatorUI);
    } else {
        injectSimulatorUI();
    }

})(window);

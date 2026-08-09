// overlay_ui.js
// 교차로 상세보기 창(Glassmorphism Overlay)의 순수 UI 조작(열기, 닫기, 탭 전환) 기능만 포함합니다.
// 실제 데이터 연동 로직은 기존 SIGMA_SIM의 연산 엔진과 별도로 연동하셔야 합니다.

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
    const title = document.getElementById('overlay-title');
    
    // 교차로명 및 ID 세팅 (기존 STATE 객체가 있다면 참조)
    if (typeof STATE !== 'undefined' && STATE.junctions && STATE.junctions[jid]) {
        title.innerText = `${STATE.junctions[jid].name || '이름 없음'} (${jid})`;
    } else {
        title.innerText = `교차로 상세 (${jid})`;
    }

    modal.style.display = 'flex';
    
    // 모달 열 때 기본 탭(신호계획정보) 활성화
    switchOverlayTab('phase');
}

function closeDetailOverlay() {
    document.getElementById('detail-overlay-modal').style.display = 'none';
}

function switchOverlayTab(tabName) {
    // 모든 탭 내용 숨기기
    document.querySelectorAll('.detail-tab-content').forEach(el => el.style.display = 'none');
    // 모든 탭 버튼 활성화 클래스 제거
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // 선택된 탭 보이기 및 활성화
    const targetContent = document.getElementById(`overlay-tab-${tabName}`);
    if (targetContent) targetContent.style.display = 'block';
    
    const targetBtn = document.getElementById(`tab-btn-${tabName}`);
    if (targetBtn) targetBtn.classList.add('active');
}

// 나침반 신호등 UI 렌더링 예시 함수 (UI 테스트용)
// 사용법: setCompassSignal('N', 'green', true) -> 북쪽 차량 신호 초록색, 점멸 켬
function setCompassSignal(direction, color, isFlashing = false) {
    // 방향 예: 'N', 'E', 'S', 'W', 'NE', 'NW', 'SE', 'SW'
    const mount = document.getElementById(`compass-${direction}`);
    if(!mount) return;

    // 기존 클래스 초기화
    const lenses = mount.querySelectorAll('.lens');
    lenses.forEach(l => {
        l.classList.remove('on', 'flash');
    });

    if (!color || color === 'off') return;

    const targetLens = mount.querySelector(`.c-${color}`);
    if (targetLens) {
        targetLens.classList.add('on');
        if (isFlashing) targetLens.classList.add('flash');
    }
}

// 지도 팝업이나 패널에서 이 UI를 호출할 수 있도록 글로벌에 노출
window.openDetailOverlay = openDetailOverlay;
window.closeDetailOverlay = closeDetailOverlay;
window.switchOverlayTab = switchOverlayTab;
window.setCompassSignal = setCompassSignal;

// DOM 로드 시 렌즈 요소 자동 생성
document.addEventListener('DOMContentLoaded', () => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    directions.forEach(dir => {
        const mount = document.getElementById(`compass-${dir}`);
        if (mount) {
            mount.innerHTML = `
                <div class="component-block">
                    <div class="car-housing-box">
                        <div class="lens c-green"></div>
                        <div class="lens c-arrow"></div>
                        <div class="lens c-yellow"></div>
                        <div class="lens c-red"></div>
                    </div>
                </div>
            `;
        }
    });

    const pedDirs = ['N', 'E', 'S', 'W'];
    pedDirs.forEach(dir => {
        const mount = document.getElementById(`ped-${dir}`);
        if (mount) {
            mount.innerHTML = `
                <div class="component-block">
                    <div class="ped-housing-box">
                        <div class="ped-lens p-green"></div>
                        <div class="ped-lens p-red on"></div>
                    </div>
                </div>
            `;
        }
    });
});

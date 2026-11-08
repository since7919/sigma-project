/**
 * insight_modal.js - SIGMA 거시/미시 교통운영 지표 상세 모달 컴포넌트
 * ─────────────────────────────────────────────────────────────
 * 역할:
 * 1. 통계 지표 정의, 계산 방식, 산출 공식, 분석적 의미 딕셔너리 제공
 * 2. 클릭 시 팝업되는 확장형 글래스모피즘 모달 창 렌더러
 */

/* ══════════════════════════════════════════
 *  지표 상세 모달 (Insight Details)
 * ══════════════════════════════════════════ */
const INSIGHT_DETAILS = {
    "macro_coord": {
        title: "🌐 전체 망 연동화율 (Network Coordination Rate)",
        def: "도시 또는 특정 지역 내 전체 신호교차로 중, 단독(고립) 제어가 아닌 연동 그룹에 속하여 인접 교차로와 신호 주기가 동기화된 교차로의 비율입니다.",
        calc: "(연동 그룹에 속한 교차로 수 / 전체 교차로 수) × 100",
        meaning: "이 수치가 높을수록 간선도로를 통과하는 차량이 연속적으로 녹색신호를 받을 확률이 높아지며, 도시 전체의 교통 흐름이 고도로 통제되고 있음을 뜻합니다."
    },
    "macro_scale": {
        title: "📏 평균 연동 규모 (Average Coordination Scale)",
        def: "구성된 1개의 연동 그룹당 평균적으로 몇 개의 교차로가 묶여 있는지를 나타냅니다.",
        calc: "연동 그룹에 속한 전체 교차로 수 / 총 연동 그룹 수",
        meaning: "수치가 클수록 하나로 길게 뻗은 '거대 간선도로'가 잘 구축된 신도시 형태이며, 수치가 작을수록 교차로 간격이 좁고 블록이 잘게 쪼개진 구도심 형태일 가능성이 높습니다."
    },
    "macro_cycle": {
        title: "⏱️ 최빈 신호주기 (Most Frequent Cycle)",
        def: "해당 지역에서 가장 많은 교차로가 채택하여 사용 중인 신호 주기(최빈값)입니다.",
        calc: "전체 교차로의 주기(Cycle Length) 데이터를 집계하여 가장 빈도수가 높은 주기를 도출합니다.",
        meaning: "보통 140초 이상의 긴 주기는 교차로가 넓고 통행량이 많은 대도시형 간선도로망을 의미하며, 100초 이하의 짧은 주기는 보행자 친화적이거나 차량 소통량이 적은 지역임을 시사합니다."
    },
    "macro_avg_cycle": {
        title: "⏳ 평균 신호주기 (Average Cycle)",
        def: "해당 지역 내 모든 교차로에서 지정된 분석 시간대 동안 실제로 운영되는 일계획(TOD) 상의 신호주기 평균입니다.",
        calc: "단순히 등록된 N개의 일계획 주기의 산술평균을 구하지 않고, 실제 도로 상황을 반영하기 위해 <b>시간 가중 평균(Time-weighted average)</b>을 사용합니다.<br><br>• <b>지정된 분석 시간대(필터) 내의 매 정각마다 가동 중인 TOD 계획을 샘플링</b>합니다.<br>• 즉, 어떤 교차로가 100초 주기로 8시간, 160초 주기로 2시간 운영된다면 각각 8번, 2번 중복 누적되어 <b>해당 계획의 유지시간에 완벽히 비례한 가중치</b>가 부여됩니다.<br>• 전체 누적된 주기 총합을 (전체 교차로 수 × 분석 시간)으로 나누어 최종 평균값을 도출합니다.",
        meaning: "네트워크 전체의 평균적인 신호 대기 및 통행 템포를 파악할 수 있으며, 최빈 신호주기와의 차이를 통해 특정 시간대나 교차로에 예외적으로 긴 주기가 얼마나 분포하는지 유추할 수 있습니다."
    },
    "macro_max_cycle": {
        title: "📈 최대 신호주기 (Maximum Cycle)",
        def: "해당 지역 내에서 하루(24시간) 동안 실제로 운영되는 일계획(TOD) 중 가장 긴 신호주기입니다.",
        calc: "전체 교차로의 일계획(TOD) 스케줄을 검사하여, 단 1시간이라도 실제 운영되도록 스케줄링된 주기 중 가장 큰 값을 추출합니다.",
        meaning: "지역 내에서 교통량이 가장 폭증하는 시간대나 교차로의 처리 한계를 보여줍니다. 이 수치가 지나치게 높다면 해당 교차로 주변의 심각한 혼잡이나 보행자의 과도한 대기시간을 암시합니다."
    },
    "macro_max_scale": {
        title: "🛣️ 최대 연동축 규모 (Max Coordination Scale)",
        def: "분석 대상 네트워크(도시 전체 또는 특정 지역) 내에서 단일 연동 그룹으로 묶여있는 교차로 개수의 최댓값입니다.",
        calc: "연동 그룹(Group ID)별로 속한 교차로 수를 집계하여 가장 큰 값을 추출합니다.",
        meaning: "이 수치는 해당 도시에서 가장 길게 끊기지 않고 통행할 수 있는 주간선도로의 길이를 대변합니다. 수치가 클수록 대규모 관통 도로가 존재하며, 거시적인 소통 축이 뚜렷함을 의미합니다."
    },
    "micro_high_cycle": {
          title: "🚨 과포화 운영 (Oversaturated / High-Cycle Ratio)",
          def: "최대 주기가 160초 이상인 교차로의 비율을 나타냅니다.",
          calc: "(최대주기 160초 이상 교차로 수 / 전체 교차로 수) × 100",
          meaning: "통상적으로 160초 이상의 고주기 운영은 신호 최적화의 한계에 도달한 과포화 상태를 의미합니다. 이 비율이 높을 경우 신호 시간 조정만으로는 정체 해소가 어려울 수 있으며, 기하구조 개선(차로 확장, 입체화 등)이 필요할 수 있습니다. 주기가 160초를 넘어가면 대기 시간이 기하급수적으로 길어져 민원이 증가합니다."
      },
      "micro_flash": {
          title: "🌙 심야 점멸 운영 (Late Night Flash Ratio)",
          def: "교통량이 급감하는 심야 시간대에 황색 또는 적색 점멸 신호를 운영하는 교차로의 비율입니다.",
          calc: "(심야 점멸 운영 교차로 수 / 전체 교차로 수) × 100",
          meaning: "교통량이 적은 시간대 신호 대기를 없애 소통을 원활하게 하고 공회전에 의한 탄소 배출을 줄입니다. 다만, 점멸 운영 비율이 지나치게 높거나 주요 간선도로에 적용될 경우 심야 과속 및 추돌 사고 위험이 증가할 수 있습니다."
      },
    "micro_ped": {
        title: "🚶 평균 보행자 지체 및 서비스수준 (Pedestrian Delay & LOS)",
        def: "한국도로용량편람(KHCM)의 신호횡단보도 분석 절차에 따라 산출한 보행자 1인당 평균 지체시간과 그에 따른 서비스수준(LOS)입니다.",
        calc: "보행자 지체(d) = (C - g)² / 2C (C: 주기, g: 유효녹색시간)<br><br>• 평균 신호주기와 <b>동일하게 시간 가중 평균(Time-weighted)</b> 방식이 적용됩니다.<br>• 지정된 시간대(필터) 내에서 매 정각마다 가동 중인 보행자 신호를 샘플링하여, 유지시간이 길수록 지체 통계에 더 큰 가중치가 부여됩니다.<br><br><b>💡 산출 예시</b><br>신호주기(C) 100초, 보행녹색시간(g) 20초인 횡단보도의 경우:<br>• d = (100 - 20)² / (2 × 100) = 80² / 200 = <b>32초</b><br>• (직관적 의미) 보행자는 100초 중 80초(적색) 동안 도착할 수 있으며, 이들의 평균 대기시간은 40초입니다. 반면 20초(녹색) 동안 도착한 사람의 대기시간은 0초입니다. 즉, (80% 확률 × 40초) + (20% 확률 × 0초) = 32초입니다.",
        meaning: "서비스수준은 A(15초 미만)부터 F(90초 초과)까지로 분류되며, 지체시간이 길어질수록 보행자의 대기 피로도가 증가하고 무단횡단 등의 위험이 높아집니다."
    },
    "micro_clearance": {
        title: "⚠️ 황색시간 이상치 (Yellow Time Anomaly)",
        def: "황색신호가 3초 미만으로 비정상적으로 짧거나, 6초 이상으로 너무 길게 설정되어 전적색(All-Red) 처리가 누락된 위험 구간의 건수입니다.",
        calc: "현시의 황색시간(Yellow)이 3초 미만이거나 6초 이상으로 설정된 교차로 개수 합산",
        meaning: "짧은 황색은 운전자의 딜레마존을 악화시켜 급제동 사고를 유발하며, 한국 규정상 5초를 초과하는 황색은 원칙적으로 금지(전적색으로 분리해야 함)되어 있으므로 너무 긴 황색은 신호 설계 오류를 암시합니다."
    },
    "micro_balance": {
        title: "⚖️ A/B링 길이 무결성 (Dual-Ring Split Integrity)",
        def: "NEMA 듀얼 링(Dual-Ring) 신호체계에서 A링과 B링에 배분된 총 신호 시간(Split)의 합이 정확히 일치하는지(무결성)를 검증한 비율입니다.",
        calc: "(A링 총 시간과 B링 총 시간이 동일한 교차로 수 / 듀얼 링 교차로 수) × 100",
        meaning: "듀얼 링 구조에서 A링과 B링의 합계는 항상 신호주기(Cycle)와 동일해야 합니다. 이 수치가 100%가 아니라면, 시간 계획 상의 물리적 오류나 구조적 결함(DB 입력 오류 등)이 존재하는 교차로가 있음을 의미합니다."
    },
    "move_left_prot": {
        title: "⬅️ 보호 좌회전 (Protected Left Turn)",
        def: "독립된 좌회전 화살표 신호를 부여하여 직진 차량과의 상충 없이 안전하게 좌회전할 수 있도록 운영하는 교차로입니다.",
        calc: "분석 시간대 기준 '반응형 현시표' 상에 표출된 보호 좌회전(실선) 화살표를 집계",
        meaning: "가장 기본적이고 안전한 좌회전 처리 방식이나, 교통량이 적은 시간대에는 불필요한 대기시간(지체)을 유발하여 전체 교차로의 효율을 저하시킬 수 있습니다."
    },
    "move_left_unprot": {
        title: "⚠️ 비보호 좌회전 (Permitted Left Turn)",
        def: "별도의 좌회전 신호 없이, 직진 녹색 신호 시 반대편 직진 차량의 빈틈(Gap)을 이용하여 좌회전하도록 허용하는 운영 방식입니다.",
        calc: "분석 시간대 기준 '반응형 현시표' 상에 표출된 비보호 좌회전(점선) 화살표를 집계",
        meaning: "좌회전 전용 현시를 생략할 수 있어 직진 방향에 더 많은 녹색시간을 부여할 수 있으므로 교차로 전체의 통행 효율을 크게 높일 수 있으나, 반대편 교통량이 많으면 사고 위험이 증가합니다."
    },
    "move_pplt": {
        title: "🔄 PPLT (Protected/Permitted Left Turn)",
        def: "보호 좌회전 신호와 비보호 좌회전을 병행하여 운영하는 방식입니다.",
        calc: "분석 시간대 기준 '반응형 현시표' 상에 보호 및 비보호 좌회전 화살표가 동시 표출된 현시를 집계",
        meaning: "좌회전 교통량이 많을 때는 보호 신호로 처리하고, 직진 신호 시에도 비보호로 추가 통과를 허용하여 좌회전 대기행렬을 효과적으로 해소할 수 있는 선진화된 운영 기법입니다."
    },
    "move_diagonal": {
        title: "✖️ 대각선 횡단보도 (Scramble/Diagonal Crossing)",
        def: "모든 차량 신호를 적색으로 통제하고, 보행 신호를 동시에 부여하여 대각선 횡단까지 허용하는 방식입니다.",
        calc: "분석 시간대 기준 '반응형 현시표' 상에 표출된 대각선 횡단보도(X자형 횡단) 보행 마커를 집계",
        meaning: "차량 우회전 시 보행자와의 상충을 원천 차단하여 보행자 안전을 극대화하지만, 보행자 전용 현시를 위한 추가 시간이 필요하므로 차량의 지체시간이 다소 증가합니다."
    },
    "move_right_sig": {
        title: "➡️ 우회전 전용신호 (Right Turn Signal)",
        def: "우회전 전용 삼색등이나 사색등을 별도로 설치하여, 우회전 차량을 별도 현시로 엄격하게 통제하는 교차로입니다.",
        calc: "분석 시간대 기준 '반응형 현시표' 상에 표출된 우회전 전용 화살표를 집계",
        meaning: "우회전 사고 다발 구역이나 보행자 통행이 잦은 곳에 설치되어 안전을 도모하나, 적색 신호 시 빈 공간이 있어도 우회전할 수 없으므로 차량 흐름이 정체될 수 있습니다."
    },
    "move_lpi": {
        title: "🚶 LPI (보행조기출발, Leading Pedestrian Interval)",
        def: "차량 녹색 신호가 켜지기 3~7초 전에 보행자 신호를 먼저 점등하여 보행자가 횡단보도에 미리 진입하도록 하는 기법입니다.",
        calc: "분석 시간대 기준 '반응형 현시표' 상에 표출된 차량보다 선행하는 보행자 신호(LPI) 패턴을 집계",
        meaning: "우회전 또는 비보호 좌회전 차량이 횡단 중인 보행자를 명확하게 인지하도록 하여 보행자 사고를 획기적으로 줄이는 저비용 고효율 안전 대책입니다."
    }
};

window.showInsightDetail = function(id) {
    const data = INSIGHT_DETAILS[id];
    if (!data) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px);";
    
    const modal = document.createElement('div');
    modal.style.cssText = "background:#252526; border:1px solid #3e3e42; border-radius:12px; width:450px; max-width:95vw; box-shadow:0 10px 40px rgba(0,0,0,0.9); display:flex; flex-direction:column; overflow:hidden; font-family:'Pretendard', sans-serif; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);";
    
    modal.innerHTML = `
        <div style="background:#1e1e1e; padding:18px 24px; border-bottom:1px solid #3e3e42; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#ffffff; font-weight:700; font-size:17px;">${data.title}</span>
            <span id="insight-modal-close" style="color:#858585; font-size:24px; cursor:pointer; line-height:1;">&times;</span>
        </div>
        
        <div style="display:flex; flex-direction:row; flex:1; overflow:hidden;">
            <!-- 좌측 기본 영역 -->
            <div style="padding:24px; display:flex; flex-direction:column; gap:20px; width:450px; flex-shrink:0; box-sizing:border-box; overflow-y:auto; max-height:70vh;">
                <div>
                    <div style="color:#e5e5e5; font-weight:700; font-size:14px; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><span style="color:#38bdf8;">📌</span> 지표 정의</div>
                    <div style="color:#d4d4d4; font-size:14px; line-height:1.6; background:rgba(0,0,0,0.3); padding:12px 16px; border-radius:8px; border:1px solid #333;">${data.def}</div>
                </div>
                <div>
                    <div style="color:#e5e5e5; font-weight:700; font-size:14px; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><span style="color:#34d399;">💡</span> 분석적 의미 (Insight)</div>
                    <div style="color:#d4d4d4; font-size:14px; line-height:1.6; background:rgba(0,0,0,0.3); padding:12px 16px; border-radius:8px; border:1px solid #333;">${data.meaning}</div>
                </div>
                <div id="insight-dynamic-content" style="display:none;">
                    <div style="color:#e5e5e5; font-weight:700; font-size:14px; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><span style="color:#fbbf24;">📊</span> 통계 분석 상세 (모수 및 이상치)</div>
                    <div id="insight-dynamic-text" style="color:#e2e8f0; font-size:14px; line-height:1.6; background:rgba(251,191,36,0.1); padding:12px 16px; border-radius:8px; border:1px solid rgba(251,191,36,0.4);"></div>
                </div>
            </div>
            
            <!-- 우측 확장 영역 -->
            <div id="insight-calc-panel" style="padding:24px; display:flex; flex-direction:column; gap:20px; width:400px; flex-shrink:0; box-sizing:border-box; border-left:1px solid #3e3e42; background:#1e1e1e; overflow-y:auto; max-height:70vh;">
                <div>
                    <div style="color:#e5e5e5; font-weight:700; font-size:14px; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><span style="color:#a78bfa;">🧮</span> 계산 방식 및 산출 예시</div>
                    <div style="color:#d4d4d4; font-size:14px; line-height:1.6; background:rgba(0,0,0,0.3); padding:12px 16px; border-radius:8px; border:1px solid #333;">${data.calc}</div>
                </div>
            </div>
        </div>
        
        <div style="padding:16px 24px; background:#1e1e1e; border-top:1px solid #3e3e42; display:flex; justify-content:space-between; align-items:center;">
            <button id="insight-modal-btn-expand" style="padding:8px 16px; background:rgba(255,255,255,0.05); color:#ccc; border:1px solid rgba(255,255,255,0.1); border-radius:6px; cursor:pointer; font-size:13px; transition:all 0.2s;">계산식 및 산출예시 보기 ➡</button>
            <button id="insight-modal-btn-close" style="padding:10px 28px; background:#007acc; color:#fff; font-weight:600; border:none; border-radius:6px; cursor:pointer; font-size:14px; transition:background 0.2s;">확인</button>
        </div>
    `;

    const dyn = window.LATEST_INSIGHT_DYNAMIC;
    if (dyn) {
        let dynHtml = '';
        if (id === 'macro_max_cycle') {
            const list = (dyn.top5MaxCycles || []).map((j, i) => `<li>${i+1}위: ${j.name} (${j.cycle}초)</li>`).join('');
            dynHtml = `<b>분석 모수:</b> 전체 ${dyn.totalJunctions.toLocaleString()}개 교차로<br><br><b style="color:#d35400;">📈 주기가 가장 긴 교차로 Top 5:</b><ul style="margin:5px 0 0 20px; padding:0;">${list || '<li>없음</li>'}</ul>`;
        }
        else if (id === 'macro_coord') dynHtml = `<b>분석 모수:</b> 전체 ${dyn.totalJunctions.toLocaleString()}개 교차로 중 연동 교차로 ${dyn.coordinatedJunctions.toLocaleString()}개`;
        else if (id === 'macro_scale') dynHtml = `<b>분석 모수:</b> 총 ${dyn.numGroups.toLocaleString()}개 연동 그룹`;
        else if (id === 'macro_max_scale') {
            const list = (dyn.top5Groups || []).map((g, i) => `<li>${i+1}위: ${g[0]} (${g[1]}개)</li>`).join('');
            dynHtml = `<b>분석 모수:</b> ${dyn.numGroups.toLocaleString()}개 연동 그룹 (총 ${dyn.coordinatedJunctions.toLocaleString()}개 교차로)<br><br><b style="color:#e74c3c;">🚨 최대 연동축 Top 5:</b><ul style="margin:5px 0 0 20px; padding:0;">${list || '<li>없음</li>'}</ul>`;
        }
        else if (id === 'micro_ped') {
            const list = dyn.worstPedJunctions.map(x => `<li>${x.name} (${x.val.toFixed(1)}초)</li>`).join('');
            dynHtml = `<b>분석 모수:</b> 보행 신호가 존재하는 ${dyn.pedWaitJunctionCount.toLocaleString()}개 교차로<br><br><b style="color:#ef4444;">⚠️ 보행자 지체 최악 교차로 Top 5:</b><ul style="margin:5px 0 0 20px; padding:0;">${list || '<li>없음</li>'}</ul>`;
        } else if (id === 'micro_clearance') {
            const list = dyn.clearanceAnomalies.slice(0, 5).map(x => `<li>${x}</li>`).join('');
            let extra = dyn.clearanceAnomalies.length > 5 ? `<li>...외 ${dyn.clearanceAnomalies.length - 5}건</li>` : '';
            dynHtml = `<b>분석 모수:</b> ${dyn.hasSignalMapCount.toLocaleString()}개 교차로<br><br><b style="color:#ef4444;">⚠️ 이상치 검출 교차로:</b><ul style="margin:5px 0 0 20px; padding:0;">${list || '<li>발견된 이상치 없음</li>'}${extra}</ul>`;
        }
        
        if (dynHtml) {
            const dc = modal.querySelector('#insight-dynamic-content');
            const dt = modal.querySelector('#insight-dynamic-text');
            if (dc && dt) {
                dc.style.display = 'block';
                dt.innerHTML = dynHtml;
            }
        }
    }
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    let expanded = false;
    const btnExpand = modal.querySelector('#insight-modal-btn-expand');
    btnExpand.onclick = () => {
        if (!expanded) {
            modal.style.width = '850px';
            btnExpand.innerHTML = '⬅ 다시 접기';
            btnExpand.style.background = 'rgba(255,255,255,0.1)';
            expanded = true;
        } else {
            modal.style.width = '450px';
            btnExpand.innerHTML = '계산식 및 산출예시 보기 ➡';
            btnExpand.style.background = 'rgba(255,255,255,0.05)';
            expanded = false;
        }
    };

    const closeFn = () => document.body.removeChild(overlay);
    modal.querySelector('#insight-modal-close').onclick = closeFn;
    modal.querySelector('#insight-modal-btn-close').onclick = closeFn;
    overlay.onclick = (e) => { if(e.target === overlay) closeFn(); };
};

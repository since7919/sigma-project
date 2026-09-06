// js/db_report.js
function openDbReportOverlay(jid) {
    const j = STATE.junctions[jid];
    if (!j) return alert("교차로 데이터를 찾을 수 없습니다.");
    
    // Create container if not exists
    let container = document.getElementById('db-report-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'db-report-container';
        document.body.appendChild(container);
    }
    
    // Build Google Maps static iframe or URL
    const lat = j.lat || 37.5665;
    const lng = j.lng || 126.9780;
    const mapHtml = `<iframe width="100%" height="100%" frameborder="0" style="border:0; pointer-events:none; min-height: 120px;" src="https://maps.google.com/maps?q=${lat},${lng}&hl=ko&z=17&output=embed" allowfullscreen></iframe>`;
    
    // TOD Plans
    const plansHTML = [1,2,3,4].map(idx => `
        <div class="db-tod-table">
            <div class="db-tod-title">TOD PLAN ${idx} ${idx===1?'(평일)':idx===2?'(토요일)':idx===3?'(일요일)':'(특수일)'}</div>
            <table class="db-table db-table-small">
                <thead><tr><th>번호</th><th>시각</th><th>주기</th><th>패턴</th></tr></thead>
                <tbody>
                    ${Array.from({length:16}).map((_, i) => {
                        const plan = (j.schedules && j.schedules[idx-1] && j.schedules[idx-1][i]) || null;
                        if (plan && plan.h !== -1) {
                            return `<tr><td>${i+1}</td><td>${String(plan.h).padStart(2,'0')}:${String(plan.m).padStart(2,'0')}</td><td>${plan.cycle}</td><td>${plan.idx}</td></tr>`;
                        } else {
                            return `<tr><td>${i+1}</td><td></td><td></td><td></td></tr>`;
                        }
                    }).join('')}
                </tbody>
            </table>
        </div>
    `).join('');

    const dayPlans = j.dayPlans || [];
    const sm = (j.signalMaps && j.signalMaps[0]) ? j.signalMaps[0] : {};
    
    // Formatting helper
    const fmt = (arr1, arr2) => {
        if(!arr1 || !arr2) return '-<br>-';
        return `${arr1.slice(0,4).map(v=>String(v).padStart(2,'0')).join(':')}<br>${arr2.slice(0,4).map(v=>String(v).padStart(2,'0')).join(':')}`;
    };
    
    // Build HTML
    const html = `
        <div class="db-report-wrapper">
            <div class="db-report-header">
                <h2>표준신호제어기데이터베이스(SEC-N9400)</h2>
                <div class="db-report-actions no-print">
                    <button class="btn-primary" onclick="window.print()">PDF로 저장 (Print)</button>
                    <button class="btn-secondary" onclick="closeDbReportOverlay()">닫기</button>
                </div>
            </div>
            
            <div class="db-report-sub">(${j.name || '알수없음'})</div>
            
            <table class="db-table db-table-bordered">
                <tr>
                    <td rowspan="2" style="width:250px; padding:0;">${mapHtml}</td>
                    <th colspan="4">교차로번호: ${jid.replace('L01-','')}</th>
                    <th colspan="4">교차로명: ${j.name || ''}</th>
                </tr>
                <tr>
                    <td colspan="8" style="padding: 0; background: #fff;">
                        <!-- Mount point for Interactive Phase Diagram -->
                        <div id="db-ipd-mount" style="pointer-events: none;"></div>
                    </td>
                </tr>
            </table>
            
            <table class="db-table db-table-bordered" style="margin-top:5px;">
                <tr>
                    <th>주현시</th><th>최소녹색<br>(MIN)</th><th>맵최대녹색<br>(MAP MAX)</th><th>중앙최대녹색<br>(HOST MAX)</th><th>보행녹색</th><th>보행점멸</th><th>황색신호</th><th>전적색신호</th><th>보행전시간</th><th>MDS</th>
                </tr>
                <tr>
                    <td>20:10:10:10<br>20:10:10:10</td>
                    <td>${fmt(sm.pedA, sm.pedB)}</td>
                    <td>100:080:060:050<br>100:080:060:050</td>
                    <td>120:080:070:050<br>120:080:070:050</td>
                    <td>${fmt(sm.pedGreenA, sm.pedGreenB)}</td>
                    <td>${fmt(sm.pedFlashA, sm.pedFlashB)}</td>
                    <td>${fmt(sm.yellowA, sm.yellowB)}</td>
                    <td>${fmt(sm.allredA, sm.allredB)}</td>
                    <td>${fmt(sm.pedDelayA, sm.pedDelayB)}</td>
                    <td>00:00:00:00<br>00:00:00:00</td>
                </tr>
            </table>
            
            <div class="db-tod-flex" style="display:flex; justify-content:space-between; margin-top:5px;">
                ${plansHTML}
                <div class="db-tod-table">
                    <div class="db-tod-title">특수일</div>
                    <table class="db-table db-table-small">
                        <thead><tr><th>번호</th><th>DAY</th><th>TOD</th></tr></thead>
                        <tbody>
                            ${Array.from({length:16}).map((_, i) => `<tr><td>${i+1}</td><td></td><td></td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top:5px; display:flex; gap:10px;">
                <table class="db-table db-table-bordered" style="flex:1;">
                    <tr><th>번호</th><th>주기</th><th>패턴</th><th>연동</th><th>현시값</th></tr>
                    ${(dayPlans[0] || []).map((tp, rowI) => {
                        const splitsA = tp?.splitA || [0,0,0,0,0,0,0,0];
                        const splitsB = tp?.splitB || [0,0,0,0,0,0,0,0];
                        if (!tp || (splitsA.every(v=>v===0) && splitsB.every(v=>v===0) && tp.cycle === 100)) {
                            return `<tr><td>${rowI+1}</td><td></td><td></td><td></td><td></td></tr>`;
                        }
                        return `
                        <tr>
                            <td>${rowI+1}</td>
                            <td>${tp.cycle || 0}</td>
                            <td>${rowI+1}</td>
                            <td>${tp.offset || 0}</td>
                            <td>
                                ${splitsA.slice(0,4).map(v=>String(v).padStart(2,'0')).join(':')}<br>
                                ${splitsB.slice(0,4).map(v=>String(v).padStart(2,'0')).join(':')}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </table>
                <div style="flex:1; border:1px solid #000; padding:10px; font-size:11px;">
                    <b>참고(295G)</b><br>
                    ○ 루프검지기 설치현황<br>
                    ○ 앞막힘검지기 2개 / 대기검지기 4개<br>
                    ○ 교차로명 변경: ${j.name || ''}<br>
                    ○ 녹색교통진흥지역 관련 서측 횡단보도 보행속도 0.8m/s 적용
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    container.style.display = 'block';
    
    // Mount original IPD exactly as-is!
    if (sm && typeof InteractivePhaseDiagram !== 'undefined') {
        const dbIpd = new InteractivePhaseDiagram('db-ipd-mount');
        dbIpd.loadFromSignalMap(sm);
        
        // Remove border for print friendly output
        const mount = document.getElementById('db-ipd-mount');
        if (mount) {
            mount.style.border = 'none';
        }
    }
    
    // Add print styles dynamically
    let style = document.getElementById('db-report-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'db-report-style';
        style.innerHTML = `
            #db-report-container {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: white; color: black; z-index: 10000; overflow-y: auto; padding: 20px; box-sizing: border-box;
                font-family: "Malgun Gothic", sans-serif;
            }
            .db-report-wrapper { max-width: 900px; margin: 0 auto; background: white; padding: 10px; border: 1px solid #ccc; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            .db-report-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 3px; margin-bottom: 5px; }
            .db-report-header h2 { margin: 0; font-size: 20px; font-weight: bold; }
            .db-report-sub { text-align: right; margin-top: -25px; margin-bottom: 5px; font-size: 12px; }
            .db-table { width: 100%; border-collapse: collapse; text-align: center; font-size: 9px; line-height: 1.1; }
            .db-table th, .db-table td { border: 1px solid #000; padding: 2px; }
            .db-table-small th, .db-table-small td { padding: 1px; font-size: 8.5px; }
            .db-tod-title { text-align: center; font-weight: bold; font-size: 9px; margin-bottom: 1px; border: 1px solid #000; border-bottom: none; padding: 1px; }
            .db-tod-table { width: 19%; }
            .btn-primary { background: #3498db; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; font-weight:bold; }
            .btn-secondary { background: #95a5a6; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; font-weight:bold; }
            
            /* Overrides for IPD inside print view */
            #db-ipd-mount .ipd-grid { background: white !important; border-bottom: none !important; }
            #db-ipd-mount .ipd-header-cell, #db-ipd-mount .ipd-row-label { background: #f0f0f0 !important; color: black !important; border-color: #000 !important; font-size: 9px !important; }
            #db-ipd-mount .ipd-cell { background: white !important; border-color: #000 !important; }
            #db-ipd-mount .ipd-arrow { stroke: #aaa !important; }
            #db-ipd-mount .ipd-arrow.ipd-active { stroke: #000 !important; }
            #db-ipd-mount .ipd-legend { display: none !important; }
            #db-ipd-mount svg marker polygon { fill: #000 !important; }
            
            @media print {
                @page { margin: 10mm; size: A4 portrait; }
                body * { visibility: hidden; }
                #db-report-container, #db-report-container * { visibility: visible; }
                #db-report-container { position: absolute; left: 0; top: 0; padding: 0; margin: 0; overflow: visible; width: 100%; box-shadow: none; border: none; }
                .db-report-wrapper { padding: 0; margin: 0; max-width: 100%; border: none; box-shadow: none; }
                .no-print { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }
}

function closeDbReportOverlay() {
    const container = document.getElementById('db-report-container');
    if (container) container.style.display = 'none';
}

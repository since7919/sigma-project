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
    const mapHtml = `<iframe width="100%" height="150" frameborder="0" style="border:0; pointer-events:none;" src="https://maps.google.com/maps?q=${lat},${lng}&hl=ko&z=17&output=embed" allowfullscreen></iframe>`;
    
    // TOD Plans
    const plansHTML = [1,2,3,4].map(idx => `
        <div class="db-tod-table">
            <div class="db-tod-title">TOD PLAN ${idx} ${idx===1?'(평일)':idx===2?'(토요일)':idx===3?'(일요일)':'(특수일)'}</div>
            <table class="db-table db-table-small">
                <thead><tr><th>번호</th><th>시각</th><th>주기</th><th>패턴</th></tr></thead>
                <tbody>
                    ${Array.from({length:16}).map((_, i) => {
                        const plan = (j.tod && j.tod.schedules && j.tod.schedules[idx-1] && j.tod.schedules[idx-1][i]) || null;
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

    // Phase splits table
    let splitRows = '';
    const dayPlans = j.tod ? j.tod.dayPlans : [];
    const usedPlans = new Set();
    if(j.tod && j.tod.schedules) {
        j.tod.schedules.forEach(sch => sch.forEach(p => { if(p.h !== -1) usedPlans.add(p.idx); }));
    }
    const sortedPlans = Array.from(usedPlans).sort((a,b)=>a-b).slice(0, 4); // Show up to 4
    
    // Generate SVG for Phase Diagram
    const getPhaseSVG = (pNum) => {
        if (!j.sm) return '';
        const idx = pNum - 1;
        const vA = j.sm.movA?.[idx] || 0;
        const pA = j.sm.pedMovA?.[idx] || 0;
        if (typeof InteractivePhaseDiagram !== 'undefined') {
            const tempHTML = InteractivePhaseDiagram.prototype.getVehSVGPaths('db', 'NS') + InteractivePhaseDiagram.prototype.getVehSVGPaths('db', 'EW') + InteractivePhaseDiagram.prototype.getVehSVGPaths('db', 'NESW') + InteractivePhaseDiagram.prototype.getVehSVGPaths('db', 'NWSE');
            // This is hacky, let's just use the known method: getVehSVGPaths and filter by active movements.
            return `<div style="width:50px; height:50px; margin:0 auto; background:#f0f0f0;"></div>`; // placeholder if complex
        }
        return '';
    };
    
    // Formatting helper
    const fmt = (arr1, arr2) => {
        if(!arr1 || !arr2) return '-<br>-';
        return `${arr1.slice(0,4).map(v=>String(v).padStart(2,'0')).join(':')}<br>${arr2.slice(4,8).map(v=>String(v).padStart(2,'0')).join(':')}`;
    };
    const sm = j.sm || {};
    
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
                    <td rowspan="2" style="width:200px; padding:0; height: 100px;">${mapHtml}</td>
                    <th colspan="2">교차로번호: ${jid.replace('L01-','')}</th>
                    <th colspan="2">교차로명: ${j.name || ''}</th>
                    <th colspan="2">시행일: ${new Date().toLocaleDateString()}</th>
                </tr>
                <tr>
                    ${[1,2,3,4,5,6].map(p => `
                    <td style="text-align:center; vertical-align:top; width:60px;">
                        <div style="border-bottom:1px solid #ccc; margin-bottom:2px;">${p}현시</div>
                        <div id="db-svg-container-${p}"></div>
                    </td>`).join('')}
                </tr>
            </table>
            
            <table class="db-table db-table-bordered" style="margin-top:10px;">
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
            
            <div class="db-tod-flex" style="display:flex; justify-content:space-between; margin-top:10px;">
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
            
            <div style="margin-top:10px; display:flex; gap:10px;">
                <table class="db-table db-table-bordered" style="flex:1;">
                    <tr><th>번호</th><th>주기</th><th>패턴</th><th>연동</th><th>현시값</th></tr>
                    ${sortedPlans.map((pidx, rowI) => {
                        const dp = dayPlans[pidx-1] || [];
                        const splitsA = dp[0]?.splitA || [0,0,0,0,0,0,0,0];
                        const splitsB = dp[0]?.splitB || [0,0,0,0,0,0,0,0];
                        return \`
                        <tr>
                            <td>\${rowI+1}</td>
                            <td>\${dp[0]?.cycle || 0}</td>
                            <td>\${pidx}</td>
                            <td>\${dp[0]?.offset || 0}</td>
                            <td>
                                \${splitsA.slice(0,4).join(':')}<br>
                                \${splitsB.slice(4,8).join(':')}
                            </td>
                        </tr>
                        \`;
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
    
    // Draw real SVGs using existing logic!
    if (j.sm && typeof InteractivePhaseDiagram !== 'undefined') {
        const dummyIPD = new InteractivePhaseDiagram('dummy-id-not-used');
        dummyIPD.loadFromSignalMap(j.sm);
        for(let p=1; p<=6; p++) {
            const svgCont = document.getElementById(`db-svg-container-\${p}`);
            if(svgCont) {
                // Just use the cell's HTML generated by IPD
                // But IPD draws cell by cell. P1-A, P1-B.
                // We want the combined cell! 
                // Let's create an SVG directly using IPD's active movements
                const mlist = [...(dummyIPD.activeMovements['P'+p+'-A']||[]), ...(dummyIPD.activeMovements['P'+p+'-B']||[])];
                const svgString = \`
                <svg viewBox="0 0 100 100" width="100%" height="60px" style="background:#fff; border-radius:3px; stroke:#000; fill:none; stroke-width:3;">
                    \${dummyIPD.getVehSVGPaths('db-'+p, 'NS')}
                    \${dummyIPD.getVehSVGPaths('db-'+p, 'EW')}
                    \${dummyIPD.getVehSVGPaths('db-'+p, 'NESW')}
                    \${dummyIPD.getVehSVGPaths('db-'+p, 'NWSE')}
                    \${dummyIPD.getPedSVGPaths('db-'+p, 'NS')}
                    \${dummyIPD.getPedSVGPaths('db-'+p, 'EW')}
                </svg>\`;
                svgCont.innerHTML = svgString;
                
                // Show only active
                setTimeout(() => {
                    const svgEl = svgCont.querySelector('svg');
                    const allArrows = svgEl.querySelectorAll('.ipd-arrow');
                    allArrows.forEach(arr => arr.style.display = 'none');
                    mlist.forEach(m => {
                        const arr = svgEl.querySelector(\`[data-mov="\${m}"]\`);
                        if(arr) {
                            arr.style.display = 'block';
                            arr.style.stroke = '#000'; // Make it black for printing
                        }
                    });
                }, 50);
            }
        }
    }
    
    // Add print styles dynamically
    let style = document.getElementById('db-report-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'db-report-style';
        style.innerHTML = \`
            #db-report-container {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: white; color: black; z-index: 10000; overflow-y: auto; padding: 20px; box-sizing: border-box;
                font-family: "Malgun Gothic", sans-serif;
            }
            .db-report-wrapper { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; }
            .db-report-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
            .db-report-header h2 { margin: 0; font-size: 24px; font-weight: bold; }
            .db-report-sub { text-align: right; margin-top: -30px; margin-bottom: 10px; font-size: 14px; }
            .db-table { width: 100%; border-collapse: collapse; text-align: center; font-size: 11px; }
            .db-table th, .db-table td { border: 1px solid #000; padding: 4px; }
            .db-table-small th, .db-table-small td { padding: 2px; font-size: 10px; }
            .db-tod-title { text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 3px; border: 1px solid #000; border-bottom: none; padding: 2px; }
            .db-tod-table { width: 19%; }
            .btn-primary { background: #3498db; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; font-weight:bold; }
            .btn-secondary { background: #95a5a6; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; font-weight:bold; }
            
            @media print {
                body * { visibility: hidden; }
                #db-report-container, #db-report-container * { visibility: visible; }
                #db-report-container { position: absolute; left: 0; top: 0; padding: 0; margin: 0; overflow: visible; width: 100%; }
                .db-report-wrapper { padding: 0; margin: 0; max-width: none; }
                .no-print { display: none !important; }
            }
        \`;
        document.head.appendChild(style);
    }
}

function closeDbReportOverlay() {
    const container = document.getElementById('db-report-container');
    if (container) container.style.display = 'none';
}

/**
 * civil.js
 * ─────────────────────────────────────────────
 * 민원 통계: CSV 파싱, 요약 렌더링, 교차로별 민원,
 * 전체 테이블 팝업, 지도 클러스터, 강조 표시
 * 의존: config.js, utils.js, ui.js, junction.js
 */

/* ══════════════════════════════════════════
 *  민원 CSV 로드
 * ══════════════════════════════════════════ */
/* ══════════════════════════════════════════
 *  민원 데이터 처리 최적화 (Lookup Map)
 * ══════════════════════════════════════════ */
/**
 * 교차로 일련번호(seq)를 jid로 즉시 변환하기 위한 맵 생성
 * O(N*M) 검색을 O(1)로 단축
 */
function buildSeqToJidMap() {
    if (STATE._seqToJidMap) return STATE._seqToJidMap;
    const map = {};
    Object.keys(STATE.junctions).forEach(jid => {
        const seq = STATE.junctions[jid].seq?.toString().trim();
        if (seq) map[seq] = jid;
    });
    STATE._seqToJidMap = map;
    return map;
}

/* ══════════════════════════════════════════
 *  민원 CSV 로드 (Web Worker 기반)
 * ══════════════════════════════════════════ */
/**
 * 엑셀 시리얼 날짜를 JS 날짜 포맷(YYYY-MM-DD)으로 변환
 */
function excelDateToJSDate(serial) {
    if (isNaN(serial) || serial === "") return serial;
    // Excel date offset adjustment (Excel thinks 1900 was a leap year)
    const date = new Date((serial - 25569) * 86400 * 1000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 다양한 날짜 형식을 YYYY-MM-DD로 표준화
 */
function normalizeDate(val) {
    if (!val) return "";
    let s = String(val).trim();
    
    // 1. 엑셀 시리얼 (5~6자리 숫자)
    if (!isNaN(s) && s.length >= 5 && s.length <= 6 && !s.includes('-') && !s.includes('.') && !s.includes('/')) {
        return excelDateToJSDate(parseFloat(s));
    }
    
    // 2. 8자리 숫자 (20210501)
    if (!isNaN(s) && s.length === 8) {
        return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    }
    
    // 3. 구분자 표준화 (. , / -> -)
    s = s.replace(/[\.\/]/g, '-');
    
    const parts = s.split('-').filter(x => x.trim() !== "");
    if (parts.length === 3) {
        let y = parts[0].trim();
        let m = parts[1].trim();
        let d = parts[2].trim();
        
        // YY-MM-DD 처리 (21-01-05 -> 2021-01-05)
        if (y.length === 2 && parseInt(y) > 0) y = "20" + y;
        m = m.padStart(2, '0');
        d = d.padStart(2, '0');
        
        // 유효한 년도인지 체크 (최소 1990년 이후)
        if (parseInt(y) > 1990 && parseInt(m) >= 1 && parseInt(m) <= 12) {
            return `${y}-${m}-${d}`;
        }
    }
    
    return s;
}

/* ══════════════════════════════════════════
 *  민원 CSV 로드 (로컬 환경 최적화)
 * ══════════════════════════════════════════ */
/* ══════════════════════════════════════════
 *  민원 CSV 로드 (통합 핸들러)
 * ══════════════════════════════════════════ */
/** 민원 CSV 데이터 생성 (통합 DB 센터용) */
function generateCivilCSV() {
    if (!STATE.civilData || STATE.civilData.length === 0) return "";
    const h = STATE.civilHeaders || [];
    let csv = h.join(",") + "\n";
    STATE.civilData.forEach(row => {
        csv += h.map(key => `"${String(row[key] || '').replace(/"/g, '""')}"`).join(",") + "\n";
    });
    return csv;
}

/** 민원 CSV 데이터 처리 핵심 로직 */
function processCivilCSV(csvString) {
    if (!csvString) {
        hideLoading();
        alert("파일 내용이 없습니다.");
        return;
    }

    showLoading("민원 데이터 분석 중... (로컬 최적화 모드)");

    // 메인 스레드 점유 방지를 위해 약간의 지연 후 실행 (UI 렌더링 시간 확보)
    setTimeout(() => {
        try {
            // 1. CSV 파싱 (고성능 캐릭터 루프)
            const allRows = parseCSVInMain(csvString);

            if (allRows.length < 2) {
                hideLoading();
                alert("유효한 데이터 행이 없습니다.");
                return;
            }

            const headers = allRows[0].map(h => h.replace(/^"|"$/g, ''));
            const dateIdx = headers.indexOf('날짜');
            const idIdx = headers.indexOf('ID');

            if (idIdx === -1) {
                hideLoading();
                alert("필수 컬럼 'ID'를 찾을 수 없습니다.\n현재 헤더: " + headers.join(', '));
                return;
            }

            const data = [];
            const byJid = {};

            // 2. 데이터 구조화 (2만 행 효율적 처리)
            for (let i = 1; i < allRows.length; i++) {
                const rowVals = allRows[i];
                if (rowVals.length < headers.length * 0.5) continue;

                const obj = {};
                headers.forEach((h, k) => {
                    let val = (rowVals[k] || '').trim();
                    // '날짜' 필드 표준화
                    if (h === '날짜') {
                        val = normalizeDate(val);
                    }
                    obj[h] = val;
                });
                obj._uid = Date.now() + Math.random();
                data.push(obj);

                const targetJid = obj['ID']?.toString().trim();
                if (targetJid && STATE.junctions[targetJid]) {
                    if (!byJid[targetJid]) byJid[targetJid] = [];
                    byJid[targetJid].push(obj);
                }
            }

            STATE.civilData = data;
            STATE.civilDataByJid = byJid;
            STATE.civilHeaders = headers;

            // 3. UI 갱신
            renderCivilSummary();
            if (STATE.activeJid) renderCivilStats(STATE.activeJid);

            // [연계] 데이터 로드 완료 후 전체 통계 및 HOME 대시보드 강제 갱신
            if (typeof refreshDBStats === 'function') refreshDBStats();
            if (typeof renderHomeDashboard === 'function') renderHomeDashboard();

            hideLoading();
            // alert(`민원 데이터 로드 완료: 총 ${data.length.toLocaleString()}건`); 
        } catch (err) {
            hideLoading();
            console.error(err);
            alert("분석 작업 중 오류 발생: " + err.message);
        }
    }, 100);
}

/**
 * 고성능 CSV 파서 (Main Thread 용)
 * Quotes 및 Multi-line 지원
 */
function parseCSVInMain(str) {
    const result = [];
    let row = [];
    let col = "";
    let inQuote = false;

    // 성능 최적화: 루프 내 객체 생성 최소화
    for (let i = 0, len = str.length; i < len; i++) {
        const char = str[i];

        if (inQuote) {
            if (char === '"' && str[i + 1] === '"') {
                col += '"';
                i++;
                continue;
            }
            if (char === '"') {
                inQuote = false;
                continue;
            }
            col += char;
        } else {
            if (char === '"') {
                inQuote = true;
                continue;
            }
            if (char === ',') {
                row.push(col.trim());
                col = "";
                continue;
            }
            if (char === '\n' || char === '\r') {
                if (char === '\r' && str[i + 1] === '\n') i++;
                if (row.length > 0 || col !== "") {
                    row.push(col.trim());
                    result.push(row);
                }
                row = [];
                col = "";
                continue;
            }
            col += char;
        }
    }
    if (row.length > 0 || col !== "") {
        row.push(col.trim());
        result.push(row);
    }
    return result;
}

/* ══════════════════════════════════════════
 *  민원 요약 렌더링
 * ══════════════════════════════════════════ */
function renderCivilSummary() {
    const container = document.getElementById('civil-summary');
    const statsContainer = document.getElementById('civil-summary-stats');
    if (!container || !statsContainer) return;
    container.style.display = 'block';

    // 1. 년/월 필터 목록 추출
    const years = new Set();
    const months = new Set();
    STATE.civilData.forEach(row => {
        const d = row['날짜'];
        if (d && d.includes('-')) {
            const parts = d.split('-');
            if (parts.length >= 2) {
                years.add(parts[0]);
                months.add(parts[1]);
            }
        }
    });

    const sortedYears = Array.from(years).sort((a, b) => b - a);
    const sortedMonths = Array.from(months).sort();

    // 2. 필터 UI 생성 및 갱신
    let filterContainer = document.getElementById('civil-filter-area');
    if (!filterContainer) {
        filterContainer = document.createElement('div');
        filterContainer.id = 'civil-filter-area';
        statsContainer.prepend(filterContainer);
    }

    // 현재 선택값 보존
    const prevYear = document.getElementById('civil-filter-year')?.value || 'ALL';
    const prevMonth = document.getElementById('civil-filter-month')?.value || 'ALL';

    filterContainer.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
            <select id="civil-filter-year" onchange="renderCivilSummary()" style="background:#1a1a1a; color:var(--accent); border:1px solid #444; border-radius:4px; font-size:12px; padding:4px 8px;">
                <option value="ALL">전체 연도</option>
                ${sortedYears.map(y => `<option value="${y}" ${y === prevYear ? 'selected' : ''}>${y}년</option>`).join('')}
            </select>
            <select id="civil-filter-month" onchange="renderCivilSummary()" style="background:#1a1a1a; color:var(--accent); border:1px solid #444; border-radius:4px; font-size:12px; padding:4px 8px;">
                <option value="ALL">전체 월</option>
                ${sortedMonths.map(m => `<option value="${m}" ${m === prevMonth ? 'selected' : ''}>${parseInt(m)}월</option>`).join('')}
            </select>
            <div style="margin-left:auto; font-size:11px; color:#888; align-self:center;">* 연보 로드 후 기간 선택</div>
        </div>
    `;

    if (!document.getElementById('civil-stats-content')) {
        const contentDiv = document.createElement('div');
        contentDiv.id = 'civil-stats-content';
        statsContainer.appendChild(contentDiv);
    }

    const selYear = document.getElementById('civil-filter-year').value;
    const selMonth = document.getElementById('civil-filter-month').value;
    const contentDiv = document.getElementById('civil-stats-content');

    // 3. 필터링된 데이터 계산
    const filtered = STATE.civilData.filter(row => {
        const d = row['날짜'];
        if (!d || !d.includes('-')) return selYear === 'ALL' && selMonth === 'ALL';
        const parts = d.split('-');
        const yMatch = selYear === 'ALL' || parts[0] === selYear;
        const mMatch = selMonth === 'ALL' || parts[1] === selMonth;
        return yMatch && mMatch;
    });

    const total = filtered.length;
    const otherCols = [
        "보행(MG)", "신호시간", "연동값", "그룹(TOD)", "기타(센터)", "기타(제어기)",
        "1.보행 대기시간 단축", "2.0.7m/s적용", "3.황색점멸(신규)", "4.황색점멸(변경)",
        "5.보행전시간", "6.전적색", "7.동시보행", "8.LPI"
    ];
    const sums = {};
    otherCols.forEach(tc => sums[tc] = 0);

    filtered.forEach(row => {
        otherCols.forEach(tc => { sums[tc] += (parseInt(row[tc]) || 0); });
    });

    const totalImprovementWeight = Object.values(sums).reduce((a, b) => a + b, 0);
    const maxSum = Math.max(...Object.values(sums), 1);

    // 4. 통계 카드 UI 구성
    let html = `
        <div style="display:flex; gap:20px;">
            <div style="flex:1; min-width:0;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:5px; margin-bottom:20px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:11px; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px;">Filtered Complaints</div>
                    <div style="font-size:32px; font-weight:800; color:var(--accent); text-shadow:0 0 15px var(--accent-glow);">${total.toLocaleString()}</div>
                </div>
                <div style="font-weight:700; color:#fff; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px; margin-bottom:12px; font-size:13px;">민원 유형 통계</div>
                <div style="max-height:250px; overflow-y:auto; padding-right:8px;">
    `;

    const typeHeader = STATE.civilHeaders.find(h => h.includes('민원유형') || h === '유형' || h === '구분');
    if (typeHeader) {
        const counts = {};
        filtered.forEach(row => {
            const val = (row[typeHeader] || '미분류').trim();
            counts[val] = (counts[val] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([key, cnt], idx) => {
            const pct = total > 0 ? ((cnt / total) * 100).toFixed(1) : "0.0";
            const color = ['#00d4ff', '#3498db', '#2ecc71', '#9b59b6', '#f1c40f'][idx % 5];
            html += `
                <div style="margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                        <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:500; color:#eee;" title="${key}">${key}</div>
                        <div style="text-align:right; font-family:'Roboto Mono', monospace; font-size:12px; font-weight:700; color:#fff;">${cnt.toLocaleString()}(${pct}%)</div>
                    </div>
                    <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;">
                        <div style="height:100%; background:${color}; width:${pct}%;"></div>
                    </div>
                </div>`;
        });
    }

    html += `</div></div>
            <div style="flex:1; min-width:0;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:5px; margin-bottom:20px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:11px; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px;">Improvement Weights</div>
                    <div style="font-size:32px; font-weight:800; color:#f1c40f; text-shadow:0 0 15px rgba(241, 196, 15, 0.4);">${totalImprovementWeight.toLocaleString()}</div>
                </div>
                <div style="font-weight:700; color:#fff; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px; margin-bottom:12px; font-size:13px;">개선 유형 통계</div>
                <div style="max-height:250px; overflow-y:auto; padding-right:8px;">
    `;

    otherCols.forEach((tc, idx) => {
        const s = sums[tc];
        const relPct = (s / maxSum * 100).toFixed(1);
        const realPct = totalImprovementWeight > 0 ? ((s / totalImprovementWeight) * 100).toFixed(1) : "0.0";
        const color = ['#00ffbb', '#3498db', '#9b59b6', '#e67e22', '#2ecc71', '#95a5a6'][idx % 6];
        html += `
        <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                <div style="font-size:12px; font-weight:500; color:#eee;">${tc}</div>
                <div style="text-align:right; font-family:'Roboto Mono', monospace; font-size:12px; font-weight:700; color:#fff;">${s.toLocaleString()}(${realPct}%)</div>
            </div>
            <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;">
                <div style="height:100%; background:${color}; width:${relPct}%;"></div>
            </div>
        </div>`;
    });

    html += `</div></div></div>`;
    contentDiv.innerHTML = html;

    const chartCont = document.getElementById('civil-chart-container');
    if (chartCont) chartCont.style.display = 'none';
}

/* ══════════════════════════════════════════
 *  민원 교차로별 내역 렌더링
 * ══════════════════════════════════════════ */
function renderCivilStats(jid) {
    const container = document.getElementById('civil-list');
    const targetNameEl = document.getElementById('civil-target-name');
    if (!container || !targetNameEl) return;

    targetNameEl.innerText = jid ? `[${STATE.junctions[jid].name}] 민원 내역 (No. ${parseInt(STATE.junctions[jid].seq)})` : "선택된 교차로 민원 (-)";

    let rawList = (jid && STATE.civilDataByJid && STATE.civilDataByJid[jid]) ? STATE.civilDataByJid[jid] : [];

    // 1. 해당 교차로 데이터에서 가능한 년도 추출
    const years = new Set();
    rawList.forEach(item => {
        const d = item['날짜'];
        if (d && d.includes('-')) years.add(d.split('-')[0]);
    });
    const sortedYears = Array.from(years).sort((a, b) => b - a);

    // 2. 필터 상태 유지
    if (!STATE.civilJidFilter) STATE.civilJidFilter = {};
    const curYearFilter = STATE.civilJidFilter[jid] || 'ALL';

    // 3. 필터링 및 최근순 정렬
    let filteredList = rawList.filter(item => {
        if (curYearFilter === 'ALL') return true;
        const d = item['날짜'];
        return d && d.startsWith(curYearFilter);
    });

    filteredList.sort((a, b) => {
        const dA = a['날짜'] || '0000-00-00';
        const dB = b['날짜'] || '0000-00-00';
        return dB.localeCompare(dA);
    });

    // 4. 헤더 정의
    const h = STATE.civilHeaders || [];
    const hCat = h.find(x => x === '구분') || '구분';
    const hImp = h.find(x => x.includes('개선항목')) || '개선항목';
    const hDoc = h.find(x => x.includes('문서번호')) || '문서번호';
    const hProj = h.find(x => x.includes('공사명')) || '공사명';
    const hMemo = h.find(x => x.includes('비고')) || '비고';

    // 5. 상단 컨트롤
    let htmlStr = `<div style="margin-bottom:15px; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="display:flex; align-items:baseline; gap:10px;">
                <span style="font-size:12px; color:var(--accent); font-weight:700;">내역 리스트 (${filteredList.length}건)</span>
                <select onchange="if(!STATE.civilJidFilter) STATE.civilJidFilter={}; STATE.civilJidFilter['${jid}']=this.value; renderCivilStats('${jid}')" 
                        style="background:#1a1a1a; color:#fff; border:1px solid #444; border-radius:4px; font-size:11px; padding:2px 6px;">
                    <option value="ALL" ${curYearFilter === 'ALL' ? 'selected' : ''}>전체 기간</option>
                    ${sortedYears.map(y => `<option value="${y}" ${curYearFilter === y ? 'selected' : ''}>${y}년</option>`).join('')}
                </select>
            </div>
            <div style="display:flex; gap:5px;">
                <button class="btn-sm" onclick="${jid ? `addCivilRecord('${jid}')` : 'alert(\\\'교차로를 선택하세요.\\\')'}" style="height:24px; padding:0 10px; font-size:11px; background:rgba(34,197,94,0.1); border:1px solid #22c55e; color:#22c55e;">➕ 추가</button>
                <button class="btn-sm" onclick="clearCivilHighlight()" style="height:24px; padding:0 10px; font-size:11px; background:rgba(255,255,255,0.05);">강조 제거</button>
            </div>
        </div>
    </div>`;

    if (rawList.length === 0) {
        htmlStr += `<div style="padding:40px 20px; color:#aaa; text-align:center; background:rgba(255,255,255,0.02); border-radius:8px;">등록된 내역이 없습니다.<br><br><small style="color:#666;">상단 '추가' 버튼으로 새 기록을 남기세요.</small></div>`;
        container.innerHTML = htmlStr;
        return;
    }

    // 6. 테이블 생성
    htmlStr += `<div style="overflow-x:auto; border-radius:8px; border:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.2);">
        <table class="yearbook-table">
            <thead>
                <tr>
                    <th style="width:80px;">날짜</th>
                    <th style="width:70px;">구분</th>
                    <th style="width:150px;">개선항목</th>
                    <th style="width:100px;">문서번호</th>
                    <th style="width:150px;">공사명</th>
                    <th>비고</th>
                    <th style="width:50px; text-align:center;">관리</th>
                </tr>
            </thead>
            <tbody>`;

        filteredList.forEach(item => {
        htmlStr += `
            <tr>
                <td class="date-cell" onclick="handleCivilCellClick(${item._uid}, '날짜')" title="클릭: 동일 일자 강조 / 더블클릭: 수정">${item['날짜'] || '-'}</td>
                <td class="cat-cell" onclick="handleCivilCellClick(${item._uid}, '${hCat.replace(/'/g, "\\'")}')" title="클릭: 동일 구분 강조 / 더블클릭: 수정">${item[hCat] || '-'}</td>
                <td onclick="handleCivilCellClick(${item._uid}, '${hImp.replace(/'/g, "\\'")}')" style="color:#fff; font-weight:500; cursor:pointer;" title="클릭: 동일 개선항목 강조 / 더블클릭: 수정">${item[hImp] || '-'}</td>
                <td onclick="handleCivilCellClick(${item._uid}, '${hDoc.replace(/'/g, "\\'")}')" style="color:#00d4ff; cursor:pointer;" title="클릭: 동일 문서번호 강조 / 더블클릭: 수정">${item[hDoc] || '-'}</td>
                <td onclick="handleCivilCellClick(${item._uid}, '${hProj.replace(/'/g, "\\'")}')" style="color:#eee; cursor:pointer;" title="클릭: 동일 공사명 강조 / 더블클릭: 수정">${item[hProj] || '-'}</td>
                <td class="memo-cell" onclick="handleCivilCellClick(${item._uid}, '${hMemo.replace(/'/g, "\\'")}')" title="클릭: 동일 비고 강조 / 더블클릭: 수정">${item[hMemo] || '-'}</td>
                <td class="action-cell">
                    <div style="display:flex; gap:4px; justify-content:center;">
                        <button onclick="deleteCivilRecord(${item._uid})" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:12px; padding:2px;" title="삭제">🗑️</button>
                    </div>
                </td>
            </tr>`;
    });

    htmlStr += `
            </tbody>
        </table>
    </div>`;

    container.innerHTML = htmlStr;
}


/* ══════════════════════════════════════════
 *  민원 전체 테이블 팝업 (청크 렌더링 최적화 모드)
 * ══════════════════════════════════════════ */
/**
 * 메인 창의 민원 데이터를 외부에서 갱신하기 위한 함수
 */
window.updateCivilData = function(newData) {
    STATE.civilData = newData;
    const byJid = {};
    STATE.civilData.forEach(obj => {
        const targetJid = obj['ID']?.toString().trim();
        if (targetJid && STATE.junctions[targetJid]) {
            if (!byJid[targetJid]) byJid[targetJid] = [];
            byJid[targetJid].push(obj);
        }
    });
    STATE.civilDataByJid = byJid;
    renderCivilSummary();
    if (STATE.activeJid) renderCivilStats(STATE.activeJid);

    // [추가] 만약 전체 테이블 창이 열려있다면 새로고침 (선택 사항)
    if (window.civilFullTableWindow && !window.civilFullTableWindow.closed) {
        // 창을 닫고 다시 열거나, 창 내부의 데이터를 직접 교체하는 로직
        // 여기서는 안전하게 창 내부 함수를 호출하거나 알림
        if (typeof window.civilFullTableWindow.updateDataFromMain === 'function') {
            window.civilFullTableWindow.updateDataFromMain(STATE.civilData);
        }
    }
};

/**
 * UI 레이아웃 및 리스트 새로고침
 */
function reloadCivilUI() {
    if (!STATE.civilData || STATE.civilData.length === 0) {
        alert("로드된 민원 데이터가 없습니다.");
        return;
    }
    // 인덱스 및 요약 재계산
    updateCivilData(STATE.civilData);
    showLoading("데이터를 최신화했습니다.");
    setTimeout(hideLoading, 500);
}

/**
 * 민원 레코드 수정
 */
function editCivilRecord(uid) {
    const record = STATE.civilData.find(r => r._uid === uid);
    if (!record) return;

    // 주요 필드 수정 (기본 prompt 활용, 필요시 모달로 확장 가능)
    const h = STATE.civilHeaders;
    const dateIdx = h.indexOf('날짜');
    const typeIdx = h.findIndex(x => x.includes('유형') || x === '구분');
    const memoIdx = h.findIndex(x => x.includes('비고'));

    const newDate = prompt("📅 날짜 수정 (YYYY-MM-DD):", record['날짜'] || "");
    if (newDate === null) return;
    
    const newType = prompt("📂 구분 수정:", record[h[typeIdx]] || "");
    if (newType === null) return;

    const newMemo = prompt("📝 비고(내용) 수정:", record[h[memoIdx]] || "");
    if (newMemo === null) return;

    // 데이터 반영
    record['날짜'] = newDate;
    if (typeIdx !== -1) record[h[typeIdx]] = newType;
    if (memoIdx !== -1) record[h[memoIdx]] = newMemo;

    // 상태 동기화 및 렌더링
    updateCivilData(STATE.civilData);
    alert("내역이 성공적으로 수정되었습니다.");
}

/**
 * 민원 레코드 삭제
 */
function deleteCivilRecord(uid) {
    if (!confirm("정말 이 내역을 삭제하시겠습니까?")) return;
    
    const index = STATE.civilData.findIndex(r => r._uid === uid);
    if (index !== -1) {
        STATE.civilData.splice(index, 1);
        updateCivilData(STATE.civilData);
        alert("내역이 삭제되었습니다.");
    }
}

/**
 * 민원 레코드 추가
 */
function addCivilRecord(jid) {
    const j = STATE.junctions[jid];
    if (!j) return;

    const newRecord = {};
    STATE.civilHeaders.forEach(h => {
        newRecord[h] = "";
    });

    // 기본값 설정
    newRecord['ID'] = j.id;
    newRecord['교차로명'] = j.name;
    newRecord['날짜'] = new Date().toISOString().split('T')[0];
    newRecord._uid = Date.now() + Math.random();

    // 데이터의 맨 앞에 추가
    STATE.civilData.unshift(newRecord);

    // [추가] 새로 추가한 내역이 필터에 걸려 안 보이지 않도록 필터를 '전체'로 초기화
    if (!STATE.civilJidFilter) STATE.civilJidFilter = {};
    STATE.civilJidFilter[jid] = 'ALL';

    updateCivilData(STATE.civilData);

    // [참고] 추가된 직후 해당 행이 바로 보이도록 스크롤링 등 처리 가능
    showLoading("새로운 내역이 추가되었습니다. 각 항목을 클릭하여 내용을 입력하세요.");
    setTimeout(hideLoading, 1500);
}

/**
 * 특정 필드 직접 수정
 */
function editSpecificCivilField(uid, fieldName) {
    const record = STATE.civilData.find(r => r._uid === uid);
    if (!record) return;

    const currentVal = record[fieldName] || "";
    const newVal = prompt(`✏️ [${fieldName}] 입력/수정:`, currentVal);
    if (newVal !== null) {
        record[fieldName] = newVal;
        updateCivilData(STATE.civilData);
    }
}

/* ══════════════════════════════════════════
 *  민원 전체 테이블 팝업 (편집 기능 추가)
 * ══════════════════════════════════════════ */
function showCivilFullTable() {
    if (!STATE.civilData || STATE.civilData.length === 0) {
        alert("먼저 민원 데이터(연보) 파일을 불러와 주세요.");
        return;
    }

    openDataTablePopup({
        title: "SIGMA - 민원 데이터 분석 (Yearbook)",
        headers: STATE.civilHeaders,
        data: STATE.civilData,
        type: "yearbook",
        existingIds: new Set(Object.keys(STATE.junctions))
    });
}

/* ══════════════════════════════════════════
 *  민원 지도 분포 (클러스터링)
 * ══════════════════════════════════════════ */
function toggleCivilMapLayer() {
    STATE.showCivilMap = !STATE.showCivilMap;
    const btn = document.getElementById('btn-civil-map');
    if (btn) btn.classList.toggle('active', STATE.showCivilMap);

    if (!STATE.showCivilMap) {
        if (STATE.civilClusterLayer) map.removeLayer(STATE.civilClusterLayer);
        return;
    }

    if (!STATE.civilData || STATE.civilData.length === 0) {
        alert("민원 데이터(연보)를 먼저 로드해주세요.");
        STATE.showCivilMap = false;
        if (btn) btn.classList.remove('active');
        return;
    }

    refreshCivilMarkers();
}

function refreshCivilMarkers() {
    if (!STATE.showCivilMap || !map) return;

    if (STATE.civilClusterLayer) map.removeLayer(STATE.civilClusterLayer);
    
    // 민원 전용 레이어 보장
    if (!map.getPane('civil-pane')) {
        map.createPane('civil-pane');
        map.getPane('civil-pane').style.zIndex = 1000; // 기본 markerPane(600)보다 상층
        map.getPane('civil-pane').style.pointerEvents = 'auto'; // 클릭 이벤트 허용
    }

    STATE.civilClusterLayer = L.markerClusterGroup({
        showCoverageOnHover: false,
        clusterPane: 'civil-pane', // 클러스터 아이콘이 그려질 레이어 지정
        zIndexOffset: 7000, 
        iconCreateFunction: function (cluster) {
            const markers = cluster.getAllChildMarkers();
            let totalCount = 0;
            markers.forEach(m => {
                totalCount += (m.options.civilCount || 1);
            });
            let c = 'civil-cluster-small';
            if (totalCount > 50) c = 'civil-cluster-medium';
            if (totalCount > 200) c = 'civil-cluster-large';
            return L.divIcon({ html: '<div><span style="z-index:7001 !important;">' + totalCount + '</span></div>', className: 'marker-cluster ' + c, iconSize: [40, 40] });
        }
    });

    // STATE.civilDataByJid는 이미 {jid: [rows]} 형태로 구조화되어 있음
    Object.keys(STATE.civilDataByJid || {}).forEach(jid => {
        const j = STATE.junctions[jid];
        if (j) {
            const count = STATE.civilDataByJid[jid].length;

            const marker = L.marker([j.lat, j.lng], {
                icon: L.divIcon({ className: 'civil-marker-icon', html: count, iconSize: [24, 24] }),
                civilCount: count,
                pane: 'civil-pane', // [추가] 전용 레이어 사용
                zIndexOffset: 5000 
            });

            marker.bindPopup(`<b>${j.name}</b><br>민원 건수: ${count}건`);
            marker.on('click', () => selectJunction(jid));

            STATE.civilClusterLayer.addLayer(marker);
        }
    });

    if (STATE.civilClusterLayer.getLayers().length > 0) {
        map.addLayer(STATE.civilClusterLayer);
    } else {
        STATE.showCivilMap = false;
        alert("표시할 민원 교차로가 맵 상에 없습니다.");
    }
}

/* ══════════════════════════════════════════
 *  민원 강조 기능
 * ══════════════════════════════════════════ */
function clearCivilHighlight() {
    if (STATE.civilHighlightLayer) {
        map.removeLayer(STATE.civilHighlightLayer);
        STATE.civilHighlightLayer = null;
    }
}

window.highlightMatchingCivil = function (field, value) {
    if (!STATE.civilData || !value) return;
    clearCivilHighlight();

    const matchingJids = new Set();
    
    STATE.civilData.forEach(row => {
        if (row[field] === value) {
            const targetJid = row['ID']?.toString().trim();
            if (targetJid && STATE.junctions[targetJid]) matchingJids.add(targetJid);
        }
    });

    if (matchingJids.size === 0) return;

    STATE.civilHighlightLayer = L.featureGroup();
    const bounds = L.latLngBounds();

    matchingJids.forEach(jid => {
        const j = STATE.junctions[jid];
        if (j) {
            const latlng = [j.lat, j.lng];

            const circle = L.circleMarker(latlng, {
                radius: 12, color: '#ffcc00', weight: 4, opacity: 0.9,
                fillColor: '#ffcc00', fillOpacity: 0.3, className: 'civil-highlight-anim',
                pane: 'civil-pane', // [추가] 강조 표시도 전용 레이어 사용
                zIndexOffset: 5000 
            }).addTo(STATE.civilHighlightLayer);

            circle.bindTooltip(`${j.name} (${value})`, { permanent: false, direction: 'top' });
            circle.on('click', () => selectJunction(jid));

            bounds.extend(latlng);
        }
    });

    if (STATE.civilHighlightLayer.getLayers().length > 0) {
        STATE.civilHighlightLayer.addTo(map);
        map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        showLoading(`'${value}' 항목 매칭 교차로 ${matchingJids.size}개 발견`);
        setTimeout(hideLoading, 1500);
    } else {
        alert("해당 항목을 가진 교차로가 현재 맵 데이터에 존재하지 않습니다.");
    }
};

/* ══════════════════════════════════════════
 *  브릿지 함수 (팝업 창 → 본체)
 * ══════════════════════════════════════════ */
window.goToJunction = function (jid) {
    if (jid && STATE.junctions[jid]) {
        selectJunctionAndZoom(jid, true);
        window.focus();
    } else {
        alert("교차로를 찾을 수 없습니다. (ID: " + jid + ")");
    }
};

/**
 * [민원 테이블 전용] 클릭/더블클릭 이벤트 충돌 방지 핸들러
 */
let civilClickTimer = null;
window.handleCivilCellClick = function(uid, field) {
    if (civilClickTimer) {
        // 더블클릭: 수정 모드
        clearTimeout(civilClickTimer);
        civilClickTimer = null;
        editSpecificCivilField(uid, field);
    } else {
        // 단일 클릭: 강조 표시
        civilClickTimer = setTimeout(() => {
            civilClickTimer = null;
            const record = STATE.civilData.find(r => r._uid === uid);
            if (record) {
                const value = record[field];
                if (value) highlightMatchingCivil(field, value);
            }
        }, 250);
    }
};

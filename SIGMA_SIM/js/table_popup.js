/* SIGMA_SIM Data Table Popup Logic */

function openDataTablePopup(options) {
    const { title = "SIGMA Data Viewer", headers = [], data = [], type = "default", onSync, existingIds = new Set() } = options;
    
    if (data.length === 0 && headers.length === 0) {
        alert("표시할 데이터가 없습니다.");
        return;
    }

    const win = window.open('', '_blank', 'width=1280,height=900,scrollbars=yes');
    if (!win) { alert("팝업이 차단되었습니다."); return; }

    const headersStr = JSON.stringify(headers).replace(/`/g, "\\`").replace(/\${/g, "\\${");
    const dataStr = JSON.stringify(data).replace(/`/g, "\\`").replace(/\${/g, "\\${");
    const idsStr = JSON.stringify(Array.from(existingIds));

    const baseHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { background: #0f172a; color: #f1f5f9; font-family: 'Pretendard', sans-serif; margin: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .top-bar { background: #1e293b; padding: 12px 25px; border-bottom: 2px solid #334155; display: flex; align-items: center; gap: 10px; flex-shrink: 0; z-index: 100; }
        .search-box { flex: 1; }
        .search-box input { width: 100%; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 7px 15px; border-radius: 6px; outline: none; }
        
        .btn { padding: 8px 15px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 5px; color: white; transition: all 0.2s; }
        .btn-add { background: #22c55e; }
        .btn-add:hover { background: #16a34a; }
        .btn-sync { background: #3b82f6; }
        .btn-sync:hover { background: #2563eb; }
        .btn-delete { background: #e74c3c; padding: 4px 8px; font-size: 11px; }
        .btn-delete:hover { background: #c0392b; }
        .btn-close { background: #64748b; }
        
        .viewport { flex: 1; overflow: auto; background: #0f172a; position: relative; }
        .spacer { position: absolute; top: 0; left: 0; right: 0; pointer-events: none; }
        .content-table { position: absolute; top: 0; left: 0; width: max-content; min-width: 100%; border-collapse: collapse; table-layout: fixed; }
        
        th { background: #1e293b; color: #94a3b8; position: sticky; top: 0; padding: 12px 10px; border-bottom: 2px solid #334155; border-right: 1px solid rgba(255,255,255,0.05); text-align: left; z-index: 100; white-space: nowrap; font-size:11px; }
        td { padding: 0 10px; border-bottom: 1px solid #1e293b; border-right: 1px solid rgba(255,255,255,0.1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; height: 35px; box-sizing: border-box; font-size: 12px; background: #0f172a; }
        tr:hover td { background: rgba(0, 212, 255, 0.08) !important; color: #fff; }
        .cell-id { text-align: center; color: #64748b; font-family: monospace; }
        .match-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
        .match-ok { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
        .match-none { background: rgba(148, 163, 184, 0.1); color: #64748b; }
        
        .editable:hover { outline: 2px solid #00d4ff; background: rgba(0, 212, 255, 0.2); }
    </style>
</head>
<body>
    <div class="top-bar">
        <div style="font-size: 18px; font-weight: 900; color: #00f3ff;">SIGMA <span style="font-weight:400; font-size:12px; color:#64748b;">DATA_CENTER</span></div>
        <div class="search-box">
            <input type="text" id="search-input" placeholder="데이터 필터링 및 검색..." autofocus>
        </div>
        <button class="btn btn-add" onclick="addRow()">➕ 행 추가</button>
        <button class="btn btn-delete" onclick="deleteRowPrompt()" style="font-size:13px; padding:8px 15px;">🗑️ 행 삭제</button>
        <button class="btn btn-sync" onclick="syncToMain()">✅ 상호 동기화 적용</button>
        <div id="status" style="font-size: 11px; color: #94a3b8; white-space: nowrap; margin: 0 10px;"></div>
        <button class="btn btn-close" onclick="window.close()">닫기</button>
    </div>

    <div class="viewport" id="viewport">
        <div class="spacer" id="spacer"></div>
        <table class="content-table" id="content-table">
            <thead id="table-head"></thead>
            <tbody id="table-body"></tbody>
        </table>
    </div>

    <script>
        // 전역 상태 및 데이터
        const type = "${type}";
        const headers = ${headersStr};
        let allData = ${dataStr};
        const existingIds = new Set(${idsStr});
        let filteredData = allData;
        
        const ROW_HEIGHT = 35;
        const BUFFER = 10; 
        
        const viewport = document.getElementById('viewport');
        const spacer = document.getElementById('spacer');
        const tableBody = document.getElementById('table-body');
        const statusEl = document.getElementById('status');
        const searchInput = document.getElementById('search-input');

        // [New] 본체에서 데이터가 갱신될 때 호출 대기 (타입이 같을 때만)
        window.updateFromMain = function(newType, newData) {
            if (newType !== type) return;
            allData = newData;
            refreshFilteredData();
            updateVirtualScroll();
            statusEl.innerText += ' (본체 동기화됨)';
        };

        // 검색 필터 갱신 함수
        function refreshFilteredData() {
            const q = (searchInput.value || "").toLowerCase().trim();
            filteredData = q ? allData.filter(row => 
                Object.values(row).some(v => String(v).toLowerCase().indexOf(q) !== -1)
            ) : allData;
        }

        // 헤더 렌더링
        function initHeaders() {
            let hHtml = '<tr><th style="width:50px; text-align:center;">No</th>';
            hHtml += '<th style="width:80px; text-align:center;">ID매칭</th>';
            headers.forEach(h => {
                let widthStyle = ' style="width:120px;"';
                if (h.includes("개선") || h.includes("비고") || h === "ID" || h === "ID_LINK") {
                    widthStyle = ' style="width:200px;"';
                }
                hHtml += '<th' + widthStyle + '>' + h + '</th>';
            });
            hHtml += '</tr>';
            document.getElementById('table-head').innerHTML = hHtml;
        }

        // 가상 스크롤 메인 엔진
        function updateVirtualScroll() {
            const scrollTop = viewport.scrollTop;
            const viewportHeight = viewport.clientHeight;
            
            const totalCount = filteredData.length;
            spacer.style.height = (totalCount * ROW_HEIGHT) + 'px';
            
            let startIndex = Math.floor(scrollTop / ROW_HEIGHT) - BUFFER;
            let endIndex = Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER;
            
            startIndex = Math.max(0, startIndex);
            endIndex = Math.min(totalCount, endIndex);
            
            const offsetY = startIndex * ROW_HEIGHT;
            tableBody.style.transform = 'translateY(' + offsetY + 'px)';
            
            let html = '';
            for (let i = startIndex; i < endIndex; i++) {
                const row = filteredData[i];
                // ID 또는 ID_LINK 컬럼을 기반으로 기존 데이터셋과 매칭 체크
                const cId = (row['ID'] || row['ID_LINK'] || row['교차로ID'] || "").toString().trim();
                const isMatched = cId && existingIds.has(cId);
                const matchHtml = isMatched ? '<span class="match-badge match-ok">매칭됨</span>' : '<span class="match-badge match-none">-</span>';

                html += '<tr><td class="cell-id">' + (i + 1) + '</td>';
                html += '<td style="text-align:center;">' + matchHtml + '</td>'; 
                headers.forEach(h => {
                    let val = (row[h] || '').toString();
                    let escapedVal = val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    let titleVal = val.replace(/"/g, "&quot;");
                    
                    let tdStyle = ' style="width:120px;"';
                    if (h.includes("개선") || h.includes("비고") || h === "ID" || h === "ID_LINK") {
                        tdStyle = ' style="width:200px; max-width:260px;"';
                    }
                    html += '<td class="editable"'+tdStyle+' onclick="editCell('+i+', \\''+h.replace(/'/g, "\\\\'")+'\\')" title="클릭하여 수정\\n' + titleVal + '">' + escapedVal + '</td>';
                });
                html += '</tr>';
            }
            tableBody.innerHTML = html;
            statusEl.innerText = filteredData.length.toLocaleString() + '건';
        }

        // 셀 수정 (prompt 활용)
        window.editCell = function(idx, header) {
            const obj = filteredData[idx];
            const currentVal = obj[header] || "";
            const newVal = prompt('수정 [' + header + ']:', currentVal);
            if (newVal !== null) {
                obj[header] = newVal;
                updateVirtualScroll();
                syncToMain(true);
            }
        };

        window.addRow = function() {
            const newObj = {};
            headers.forEach(h => { newObj[h] = ""; });
            newObj._uid = Date.now() + Math.random();
            allData.unshift(newObj);
            refreshFilteredData();
            viewport.scrollTop = 0;
            updateVirtualScroll();
            syncToMain(true);
            alert("새 행이 추가되었습니다.");
        };

        window.deleteRowPrompt = function() {
            const rowNo = prompt("삭제할 No 입력:");
            if (rowNo === null) return;
            const idx = parseInt(rowNo) - 1;
            if (isNaN(idx) || idx < 0 || idx >= filteredData.length) return;
            if (!confirm(rowNo + "번 행을 삭제하시겠습니까?")) return;
            
            const targetUid = filteredData[idx]._uid;
            allData = allData.filter(r => r._uid !== targetUid);
            refreshFilteredData();
            updateVirtualScroll();
            syncToMain(true);
        };

        // 데이터 적용 브릿지
        window.syncToMain = function(silent) {
            if (window.opener && !window.opener.closed) {
                // 타입별로 본체의 알맞은 갱신 함수 호출
                const op = window.opener;
                if (type === "yearbook" && typeof op.updateCivilData === 'function') {
                    op.updateCivilData(allData);
                } else if (typeof op.updateGlobalDBState === 'function') {
                    // 범용 DB 갱신 핸들러 호출
                    op.updateGlobalDBState(type, allData);
                }
                if (!silent) alert("수정사항이 반영되었습니다.");
            }
        };

        // 검색 이벤트 바인딩
        let searchTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                refreshFilteredData();
                viewport.scrollTop = 0;
                updateVirtualScroll();
            }, 200);
        });

        viewport.addEventListener('scroll', updateVirtualScroll);
        window.addEventListener('resize', updateVirtualScroll);
        
        initHeaders();
        updateVirtualScroll();
    </script>
</body>
</html>
`;
    win.document.write(baseHtml);
    win.document.close();
}

/* ══════════════════════════════════════════
 *  Dashboard Home 초기화 (Home 버튼 로직)
 * ══════════════════════════════════════════ */

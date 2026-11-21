/**
 * SIGMA Data Viewer Controller
 * Tabulator 기반의 교차로/현시/TOD/그룹 데이터 조회, 인라인 편집, 일괄 DB 저장 모듈
 */
document.addEventListener('DOMContentLoaded', () => {
    let currentTable = 'junctions';
    let tabulatorInstance = null;

    // 환경에 따라 API 엔드포인트 자동 결정 (배포 환경 및 로컬 환경 동시 지원)
    const API_BASE = (window.location.protocol === 'file:') 
        ? 'http://localhost:3000/api/sim/tables' 
        : `${window.location.origin}/api/sim/tables`;

    const tabs = document.querySelectorAll('.tab');
    const regionSelect = document.getElementById('region-select');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnDownload = document.getElementById('btn-download');
    const btnAddRows = document.getElementById('btn-add-rows');
    const btnSaveDb = document.getElementById('btn-save-db');

    // 탭 전환 이벤트
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTable = tab.dataset.table;
            loadData();
        });
    });

    // 컨트롤 버튼 이벤트
    if (regionSelect) regionSelect.addEventListener('change', loadData);
    if (btnRefresh) btnRefresh.addEventListener('click', loadData);
    
    // CSV 다운로드
    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            if (tabulatorInstance) {
                const regVal = regionSelect ? regionSelect.value : '';
                tabulatorInstance.download("csv", `sigma_${currentTable}_${regVal || 'All'}.csv`);
            }
        });
    }

    // 새 행 10개 추가 기능
    if (btnAddRows) {
        btnAddRows.addEventListener('click', () => {
            if (!tabulatorInstance) return;
            for (let i = 0; i < 10; i++) {
                tabulatorInstance.addRow({}, true);
            }
        });
    }

    // DB에 일괄 저장 기능
    if (btnSaveDb) {
        btnSaveDb.addEventListener('click', async () => {
            if (!tabulatorInstance) return;
            
            const allData = tabulatorInstance.getData();
            // 유효 ID가 있는 행만 필터링
            const validData = allData.filter(row => row.id !== undefined && row.id !== null && String(row.id).trim() !== '');
            
            if (validData.length === 0) {
                alert("저장할 유효한 데이터(ID가 존재하는 행)가 없습니다.");
                return;
            }

            if (!confirm(`총 ${validData.length}개의 레코드를 데이터베이스에 일괄 저장하시겠습니까?\n(기존 데이터는 덮어쓰기 되며 복구할 수 없습니다)`)) {
                return;
            }

            const password = prompt("백엔드 데이터베이스를 직접 수정합니다.\n승인된 관리자만 접근 가능합니다. 비밀번호를 입력하세요:");
            if (!password) return;
            if (password !== '1234') {
                alert("비밀번호가 일치하지 않습니다.");
                return;
            }

            btnSaveDb.textContent = "저장 중...";
            btnSaveDb.disabled = true;

            try {
                const chunkSize = currentTable === 'junctions' ? validData.length : 500;
                let totalCount = 0;

                for (let i = 0; i < validData.length; i += chunkSize) {
                    const chunk = validData.slice(i, i + chunkSize);
                    const pct = Math.round((i / validData.length) * 100);
                    btnSaveDb.textContent = `저장 중... (${i}/${validData.length}건, ${pct}%)`;

                    const response = await fetch(`${API_BASE}/${currentTable}/bulk`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password, records: chunk })
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || '저장 실패');
                    }
                    totalCount += (result.count || chunk.length);
                }

                alert(`총 ${totalCount}건이 성공적으로 저장되었습니다.`);
                loadData();
            } catch (error) {
                console.error("DB 일괄 저장 오류:", error);
                alert(`오류 발생: ${error.message}`);
            } finally {
                btnSaveDb.textContent = "💾 DB에 일괄 저장";
                btnSaveDb.disabled = false;
            }
        });
    }

    /**
     * 데이터 로딩 및 Tabulator 인스턴스화
     */
    function loadData() {
        const regionCode = regionSelect ? regionSelect.value : '';
        const url = `${API_BASE}/${currentTable}${regionCode ? `?regionCode=${regionCode}` : ''}`;
        
        if (tabulatorInstance) {
            tabulatorInstance.destroy();
            tabulatorInstance = null;
        }

        tabulatorInstance = new Tabulator("#data-table", {
            ajaxURL: url,
            layout: "fitDataFill",
            autoColumns: true,
            autoColumnsDefinitions: function (definitions) {
                // 모든 자동 컬럼에 대해 인라인 텍스트 편집기 허용
                definitions.forEach(column => {
                    column.editor = "input";
                    column.headerFilter = "input"; // 헤더 필터 추가로 빠른 검색 지원
                    column.headerFilterPlaceholder = "검색...";
                });
                return definitions;
            },
            selectable: true,
            clipboard: true, // 복사 가능
            clipboardPasteAction: "replace", // 붙여넣기 치환
            clipboardPasteParser: "tab", // 엑셀 탭 구분자 호환
            pagination: "local",
            paginationSize: 100,
            paginationSizeSelector: [50, 100, 500, 1000],
            movableColumns: true,
            placeholder: "데이터를 로딩 중이거나 표시할 데이터가 없습니다.",
            rowHeight: 30,
            ajaxResponse: function (url, params, response) {
                if (!Array.isArray(response)) {
                    console.warn("응답 데이터가 배열이 아닙니다:", response);
                    return [];
                }
                return response.map(row => {
                    for (let key in row) {
                        if (typeof row[key] === 'object' && row[key] !== null) {
                            row[key] = JSON.stringify(row[key]);
                        }
                    }
                    return row;
                });
            },
            ajaxError: function (error) {
                console.error("데이터 로드 실패:", error);
                const tableEl = document.getElementById('data-table');
                if (tableEl) {
                    tableEl.innerHTML = `
                        <div style="padding:40px; text-align:center; color:#ef4444; font-size:14px;">
                            데이터를 불러오지 못했습니다.<br>
                            <span style="font-size:12px; color:#94a3b8; margin-top:8px; display:inline-block;">(${url})</span><br>
                            <button onclick="location.reload()" style="margin-top:15px; padding:6px 14px; background:#1e293b; color:#38bdf8; border:1px solid #38bdf8; border-radius:4px; cursor:pointer;">
                                다시 시도
                            </button>
                        </div>
                    `;
                }
            }
        });
    }

    // 초기 실행
    loadData();
});

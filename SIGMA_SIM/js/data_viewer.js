document.addEventListener('DOMContentLoaded', () => {
    let currentTable = 'junctions';
    let tabulatorInstance = null;

    const API_BASE = 'http://localhost:3000/api/sim/tables';

    const tabs = document.querySelectorAll('.tab');
    const regionSelect = document.getElementById('region-select');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnDownload = document.getElementById('btn-download');
    const btnAddRows = document.getElementById('btn-add-rows');
    const btnSaveDb = document.getElementById('btn-save-db');

    // 탭 이벤트 설정
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTable = tab.dataset.table;
            loadData();
        });
    });

    // 컨트롤 버튼 이벤트 설정
    regionSelect.addEventListener('change', loadData);
    btnRefresh.addEventListener('click', loadData);
    
    btnDownload.addEventListener('click', () => {
        if(tabulatorInstance) {
            tabulatorInstance.download("csv", `sigma_${currentTable}_${regionSelect.value || 'All'}.csv`);
        }
    });

    // 새 행 추가 기능
    btnAddRows.addEventListener('click', () => {
        if(!tabulatorInstance) return;
        // 상단에 빈 행 10개 추가
        for(let i=0; i<10; i++) {
            tabulatorInstance.addRow({}, true);
        }
    });

    // DB에 일괄 저장 기능
    btnSaveDb.addEventListener('click', async () => {
        if(!tabulatorInstance) return;
        
        // 전체 데이터 또는 필터링된 데이터를 가져옵니다.
        const allData = tabulatorInstance.getData();
        
        // 완전히 비어있는 행(새로 추가만 하고 입력안한 행) 필터링
        const validData = allData.filter(row => row.id !== undefined && row.id !== null && String(row.id).trim() !== '');
        
        if (validData.length === 0) {
            alert("저장할 유효한 데이터(ID가 있는 행)가 없습니다.");
            return;
        }

        if(!confirm(`총 ${validData.length}개의 레코드를 데이터베이스에 일괄 저장하시겠습니까? (기존 데이터는 덮어쓰기 되며 복구할 수 없습니다)`)) {
            return;
        }

        btnSaveDb.textContent = "저장 중...";
        btnSaveDb.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/${currentTable}/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(validData)
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || '저장 실패');
            }

            alert(result.message || '성공적으로 저장되었습니다.');
            loadData(); // 저장 후 새로고침
        } catch (error) {
            console.error(error);
            alert(`오류 발생: ${error.message}`);
        } finally {
            btnSaveDb.textContent = "💾 DB에 일괄 저장";
            btnSaveDb.disabled = false;
        }
    });

    function loadData() {
        const regionCode = regionSelect.value;
        const url = `${API_BASE}/${currentTable}${regionCode ? `?regionCode=${regionCode}` : ''}`;
        
        if (tabulatorInstance) {
            tabulatorInstance.destroy();
        }

        tabulatorInstance = new Tabulator("#data-table", {
            ajaxURL: url,
            layout: "fitDataFill",
            autoColumns: true,
            autoColumnsDefinitions: function(definitions){
                // 모든 자동 생성 컬럼에 대해 텍스트 편집기(editor) 허용
                definitions.forEach((column) => {
                    column.editor = "input"; // 더블클릭 시 편집 가능
                });
                return definitions;
            },
            selectable: true,
            clipboard: true, // 복사 가능
            clipboardPasteAction: "replace", // 붙여넣기 시 내용 덮어쓰기 (기본 지원)
            clipboardPasteParser: "tab", // 엑셀은 탭 구분자를 사용하므로 명시적 설정
            pagination: "local",
            paginationSize: 100,
            paginationSizeSelector: [50, 100, 500, 1000],
            movableColumns: true,
            placeholder: "데이터가 없습니다.",
            rowHeight: 30,
            ajaxResponse: function(url, params, response) {
                return response.map(row => {
                    for(let key in row) {
                        if(typeof row[key] === 'object' && row[key] !== null) {
                            row[key] = JSON.stringify(row[key]);
                        }
                    }
                    return row;
                });
            }
        });
    }

    // 초기 로딩
    loadData();
});

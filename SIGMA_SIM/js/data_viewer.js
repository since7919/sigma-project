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

    // 0. 시뮬레이터에서 전달받은 지역 코드(URL 파라미터 또는 localStorage) 초기 연동
    const urlParams = new URLSearchParams(window.location.search);
    const initialRegion = urlParams.get('regionCode') || localStorage.getItem('sigma_selected_region');
    if (initialRegion !== null && initialRegion !== undefined && regionSelect) {
        const exists = Array.from(regionSelect.options).some(opt => opt.value === initialRegion);
        if (exists) {
            regionSelect.value = initialRegion;
        }
    }

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
    if (regionSelect) {
        regionSelect.addEventListener('change', () => {
            if (regionSelect.value) {
                localStorage.setItem('sigma_selected_region', regionSelect.value);
            }
            loadData();
        });
    }
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

    // ─── 관리자 비밀번호 확인 모달 제어 ───
    const passwordModal = document.getElementById('password-modal');
    const modalTableBadge = document.getElementById('modal-table-badge');
    const modalRegionBadge = document.getElementById('modal-region-badge');
    const modalCountBadge = document.getElementById('modal-count-badge');
    const modalPasswordInput = document.getElementById('modal-password-input');
    const btnTogglePw = document.getElementById('btn-toggle-pw');
    const modalMsg = document.getElementById('modal-msg');
    const modalProgressBox = document.getElementById('modal-progress-box');
    const modalProgressFill = document.getElementById('modal-progress-fill');
    const modalProgressText = document.getElementById('modal-progress-text');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');

    let pendingSaveData = null;

    function openPasswordModal(validData) {
        pendingSaveData = validData;
        if (modalTableBadge) modalTableBadge.textContent = `테이블: ${currentTable}`;
        if (modalRegionBadge) {
            const regText = regionSelect && regionSelect.selectedIndex >= 0 
                ? regionSelect.options[regionSelect.selectedIndex].text 
                : '전체 (All)';
            modalRegionBadge.textContent = `지역: ${regText}`;
        }
        if (modalCountBadge) {
            modalCountBadge.textContent = `반영 건수: ${validData.length.toLocaleString()}건`;
        }
        if (modalPasswordInput) {
            modalPasswordInput.value = '';
            modalPasswordInput.type = 'password';
            modalPasswordInput.classList.remove('error');
            modalPasswordInput.disabled = false;
        }
        if (modalMsg) {
            modalMsg.style.color = '#ef4444';
            modalMsg.textContent = '';
        }
        if (modalProgressBox) modalProgressBox.classList.remove('active');
        if (modalProgressFill) modalProgressFill.style.width = '0%';
        if (modalProgressText) modalProgressText.textContent = '저장 진행 중... 0%';
        if (btnModalConfirm) {
            btnModalConfirm.disabled = false;
            btnModalConfirm.textContent = '인증 및 DB 저장';
        }
        if (btnModalCancel) btnModalCancel.disabled = false;

        if (passwordModal) {
            passwordModal.classList.add('active');
            setTimeout(() => {
                if (modalPasswordInput) modalPasswordInput.focus();
            }, 80);
        }
    }

    function closePasswordModal() {
        if (passwordModal) passwordModal.classList.remove('active');
        pendingSaveData = null;
    }

    if (btnModalCancel) {
        btnModalCancel.addEventListener('click', closePasswordModal);
    }

    // 모달 배경 클릭 시 닫기 (저장 진행 중이 아닐 때만)
    if (passwordModal) {
        passwordModal.addEventListener('click', (e) => {
            if (e.target === passwordModal && (!btnModalConfirm || !btnModalConfirm.disabled)) {
                closePasswordModal();
            }
        });
    }

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && passwordModal && passwordModal.classList.contains('active')) {
            if (!btnModalConfirm || !btnModalConfirm.disabled) {
                closePasswordModal();
            }
        }
    });

    // 비밀번호 보이기/숨기기 토글
    if (btnTogglePw && modalPasswordInput) {
        btnTogglePw.addEventListener('click', () => {
            if (modalPasswordInput.type === 'password') {
                modalPasswordInput.type = 'text';
                btnTogglePw.textContent = '🔒';
            } else {
                modalPasswordInput.type = 'password';
                btnTogglePw.textContent = '👁️';
            }
        });
    }

    // 비밀번호 입력창 엔터 키 이벤트
    if (modalPasswordInput) {
        modalPasswordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (btnModalConfirm && !btnModalConfirm.disabled) {
                    btnModalConfirm.click();
                }
            }
        });
        modalPasswordInput.addEventListener('input', () => {
            modalPasswordInput.classList.remove('error');
            if (modalMsg) modalMsg.textContent = '';
        });
    }

    // 모달 내 확인(인증 및 DB 일괄 저장) 실행
    if (btnModalConfirm) {
        btnModalConfirm.addEventListener('click', async () => {
            if (!pendingSaveData || pendingSaveData.length === 0) {
                alert('저장할 데이터가 유효하지 않습니다.');
                closePasswordModal();
                return;
            }

            const password = modalPasswordInput ? modalPasswordInput.value.trim() : '';
            if (!password) {
                if (modalPasswordInput) modalPasswordInput.classList.add('error');
                if (modalMsg) {
                    modalMsg.style.color = '#ef4444';
                    modalMsg.textContent = '관리자 비밀번호를 입력해주세요.';
                }
                if (modalPasswordInput) modalPasswordInput.focus();
                return;
            }

            // 1단계: 백엔드 비밀번호 사전 검증
            const verifyUrl = API_BASE.replace(/\/tables$/, '') + '/verify-password';
            try {
                btnModalConfirm.disabled = true;
                btnModalCancel.disabled = true;
                if (modalPasswordInput) modalPasswordInput.disabled = true;
                if (modalMsg) {
                    modalMsg.style.color = '#00d4ff';
                    modalMsg.textContent = '비밀번호 검증 중...';
                }

                const vResp = await fetch(verifyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const vData = await vResp.json();
                if (!vResp.ok || !vData.valid) {
                    // 인증 실패 처리
                    if (modalPasswordInput) {
                        modalPasswordInput.disabled = false;
                        modalPasswordInput.classList.add('error');
                        modalPasswordInput.focus();
                        modalPasswordInput.select();
                    }
                    if (modalMsg) {
                        modalMsg.style.color = '#ef4444';
                        modalMsg.textContent = vData.error || '비밀번호가 일치하지 않습니다.';
                    }
                    btnModalConfirm.disabled = false;
                    btnModalCancel.disabled = false;
                    return;
                }

                // 2단계: 인증 성공 -> 일괄 업서트 진행
                if (modalMsg) {
                    modalMsg.style.color = '#00ffaa';
                    modalMsg.textContent = '✓ 인증 완료. Supabase DB에 반영 중...';
                }
                if (modalProgressBox) modalProgressBox.classList.add('active');

                const validData = pendingSaveData;
                const chunkSize = currentTable === 'junctions' ? validData.length : 500;
                let totalCount = 0;

                for (let i = 0; i < validData.length; i += chunkSize) {
                    const chunk = validData.slice(i, i + chunkSize);
                    const pct = Math.round((i / validData.length) * 100);
                    if (modalProgressFill) modalProgressFill.style.width = `${pct}%`;
                    if (modalProgressText) {
                        modalProgressText.textContent = `저장 진행 중... (${i.toLocaleString()} / ${validData.length.toLocaleString()}건, ${pct}%)`;
                    }

                    const response = await fetch(`${API_BASE}/${currentTable}/bulk`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password, records: chunk })
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || '저장 처리 중 서버 오류가 발생했습니다.');
                    }
                    totalCount += (result.count || chunk.length);
                }

                if (modalProgressFill) modalProgressFill.style.width = '100%';
                if (modalProgressText) {
                    modalProgressText.textContent = `✓ 저장 완료! 총 ${totalCount.toLocaleString()}건 반영됨`;
                }
                if (modalMsg) {
                    modalMsg.style.color = '#00ffaa';
                    modalMsg.textContent = `✓ 성공: ${totalCount.toLocaleString()}건이 데이터베이스에 안전하게 반영되었습니다.`;
                }

                setTimeout(() => {
                    closePasswordModal();
                    alert(`총 ${totalCount.toLocaleString()}건이 데이터베이스에 성공적으로 저장되었습니다.`);
                    loadData();
                }, 600);

            } catch (error) {
                console.error("DB 일괄 저장 오류:", error);
                if (modalMsg) {
                    modalMsg.style.color = '#ef4444';
                    modalMsg.textContent = `오류 발생: ${error.message}`;
                }
                if (modalPasswordInput) modalPasswordInput.disabled = false;
                btnModalConfirm.disabled = false;
                btnModalCancel.disabled = false;
            }
        });
    }

    // DB에 일괄 저장 버튼 클릭 이벤트 -> 전용 모달 호출
    if (btnSaveDb) {
        btnSaveDb.addEventListener('click', () => {
            if (!tabulatorInstance) return;
            
            const allData = tabulatorInstance.getData();
            // 유효 ID가 있는 행만 필터링 (junctions/signal_maps/tod_plans: id, groups: group_id)
            const validData = allData.filter(row => {
                const idVal = row.id ?? row.group_id ?? row.ID ?? row.GroupID;
                return idVal !== undefined && idVal !== null && String(idVal).trim() !== '';
            });
            
            if (validData.length === 0) {
                alert("저장할 유효한 데이터(ID가 존재하는 행)가 없습니다.");
                return;
            }

            // 모달 열기
            openPasswordModal(validData);
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
                // junctions 테이블인 경우 arrow_configs 바로 옆에 reservations가 나란히 오도록 배치
                if (currentTable === 'junctions') {
                    const preferredOrder = [
                        'id', 'region_cd', 'name', 'arrow_configs', 'reservations',
                        'group_id', 'controller', 'diagram_order', 'weekly_plan',
                        'police', 'office', 'lat', 'lng', 'seq', 'api_int_no', 'created_at', 'updated_at'
                    ];
                    definitions.sort((a, b) => {
                        const idxA = preferredOrder.indexOf(a.field);
                        const idxB = preferredOrder.indexOf(b.field);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return 0;
                    });
                }

                // 모든 자동 컬럼에 대해 인라인 텍스트 편집기 허용
                definitions.forEach(column => {
                    column.editor = "input";
                    column.headerFilter = "input"; // 헤더 필터 추가로 빠른 검색 지원
                    column.headerFilterPlaceholder = "검색...";
                    if (column.field === 'arrow_configs' || column.field === 'reservations') {
                        column.width = 240;
                    }
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

/**
 * ==============================================================================
 * SIGMA Traffic Management System - Junction Notes & Calendar Module
 * 파일명: junction_notes.js
 * 설명: 교차로 상세 정보창의 메모 관리 및 날짜 연동형 운영 캘린더/이력 관리 모듈
 * 저장소: 클라이언트 IndexedDB + LocalStorage + 백엔드 Supabase (3중 영구 저장)
 * ==============================================================================
 */

(function (window) {
    'use strict';

    // 전역 상태 관리 객체
    const JunctionNotes = {
        state: {
            jid: null,
            currentYear: new Date().getFullYear(),
            currentMonth: new Date().getMonth(), // 0-based
            selectedDate: formatDate(new Date()),
            viewMode: 'calendar', // 'calendar' | 'list'
            debounceTimer: null,
            lastSavedAt: null,
            isSaving: false
        },

        // 카테고리 정의 (라벨 및 색상 테마)
        categories: {
            '점검': { label: '정기점검', bg: 'rgba(16, 185, 129, 0.2)', border: '#10b981', color: '#6ee7b7' },
            '신호': { label: '신호변경', bg: 'rgba(56, 189, 248, 0.2)', border: '#38bdf8', color: '#7dd3fc' },
            '보수': { label: '시설보수', bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', color: '#fcd34d' },
            '민원': { label: '민원접수', bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', color: '#fca5a5' },
            '메모': { label: '일반메모', bg: 'rgba(168, 85, 247, 0.2)', border: '#a855f7', color: '#d8b4fe' }
        }
    };

    /** 날짜 포맷 (YYYY-MM-DD) */
    function formatDate(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /** 현재 시간 포맷 (HH:mm) */
    function formatTime(d) {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    /** 날짜 표시용 한글 요일 */
    function getDayOfWeek(dateStr) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '' : days[d.getDay()];
    }

    /**
     * 교차로 데이터 객체 가져오기 (STATE.junctions 다중 키 자동 해석 및 폴백 보장)
     */
    function getJunction(jid) {
        const targetId = jid || JunctionNotes.state.jid || window._currentOverlayJid || (window.STATE && window.STATE.activeJid);
        if (!targetId) return null;

        if (window.STATE && window.STATE.junctions) {
            // 1. 직접 일치
            if (window.STATE.junctions[targetId]) return window.STATE.junctions[targetId];

            // 2. 지역 접두사 추가/제거 일치
            if (window.STATE.junctions[`L01-${targetId}`]) return window.STATE.junctions[`L01-${targetId}`];
            if (window.STATE.junctions[`L02-${targetId}`]) return window.STATE.junctions[`L02-${targetId}`];

            const rawId = String(targetId).replace(/^[A-Z0-9]+-/, '');
            if (window.STATE.junctions[rawId]) return window.STATE.junctions[rawId];

            // 3. seq 및 ID 전체 검색
            const list = Object.values(window.STATE.junctions);
            const found = list.find(item => 
                String(item.id) === String(targetId) || 
                String(item.seq) === String(targetId) || 
                String(item.seq) === rawId
            );
            if (found) return found;
        }

        // 4. 안전장치: UI 렌더링 무조건 보장을 위한 기본 객체 반환
        return { id: targetId, name: `교차로 (${targetId})`, memo: '', calendarEvents: [] };
    }

    /**
     * 교차로 메모/캘린더 데이터 비동기 로드
     * 1) STATE 캐시
     * 2) LocalStorage 캐시
     * 3) 백엔드 DB (/api/sim/junction-notes/:jid) 호출 및 동기화
     */
    async function loadJunctionNotes(jid) {
        const targetId = jid || JunctionNotes.state.jid || window._currentOverlayJid || (window.STATE && window.STATE.activeJid);
        if (!targetId) return;
        JunctionNotes.state.jid = targetId;

        const j = getJunction(targetId);
        if (!j) return;

        // 기본 속성 초기화
        if (typeof j.memo !== 'string') j.memo = '';
        if (!Array.isArray(j.calendarEvents)) j.calendarEvents = [];

        // 1) LocalStorage 복원 시도
        try {
            const localRaw = localStorage.getItem(`sigma_junction_notes_${jid}`);
            if (localRaw) {
                const localData = JSON.parse(localRaw);
                if (localData && typeof localData.memo === 'string' && !j.memo) {
                    j.memo = localData.memo;
                }
                if (Array.isArray(localData.calendarEvents) && j.calendarEvents.length === 0) {
                    j.calendarEvents = localData.calendarEvents;
                }
                if (localData.updatedAt) {
                    JunctionNotes.state.lastSavedAt = localData.updatedAt;
                }
            }
        } catch (e) {
            console.warn('[JunctionNotes] LocalStorage read failed:', e);
        }

        // UI 즉시 렌더링
        renderJunctionNotesUI();

        // 2) 백엔드 DB에서 최신 데이터 비동기 조회
        try {
            const res = await fetch(`/api/sim/junction-notes/${encodeURIComponent(jid)}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) {
                    let updated = false;
                    if (data.memo !== undefined && data.memo !== j.memo) {
                        j.memo = data.memo || '';
                        updated = true;
                    }
                    if (Array.isArray(data.calendarEvents)) {
                        j.calendarEvents = data.calendarEvents;
                        updated = true;
                    }
                    if (data.updatedAt) {
                        JunctionNotes.state.lastSavedAt = data.updatedAt;
                    }
                    if (updated) {
                        // 로컬 캐시 갱신
                        saveToLocalCache(jid, j);
                        renderJunctionNotesUI();
                    }
                }
            }
        } catch (err) {
            console.warn('[JunctionNotes] Backend sync failed, offline cache maintained:', err);
        }
    }

    /**
     * 로컬 스토리지 및 IDB 캐시 저장
     */
    function saveToLocalCache(jid, j) {
        try {
            const payload = {
                jid,
                memo: j.memo || '',
                calendarEvents: j.calendarEvents || [],
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(`sigma_junction_notes_${jid}`, JSON.stringify(payload));
            if (window.SigmaIDB && typeof window.SigmaIDB.saveJunction === 'function') {
                window.SigmaIDB.saveJunction(j).catch(() => {});
            }
        } catch (e) {
            console.warn('[JunctionNotes] Local cache write failed:', e);
        }
    }

    /**
     * DB(백엔드/Supabase)로 메모 및 캘린더 영구 저장
     */
    async function saveJunctionNotesToDB(showFeedback = true) {
        const jid = JunctionNotes.state.jid;
        if (!jid) return;
        const j = getJunction(jid);
        if (!j) return;

        // UI에서 현재 메모 값 추출
        const memoEl = document.getElementById('junction-memo-textarea');
        if (memoEl) {
            j.memo = memoEl.value;
        }

        // 로컬 캐시 즉각 보존
        saveToLocalCache(jid, j);

        const statusEl = document.getElementById('junction-notes-save-status');
        if (statusEl) {
            statusEl.innerHTML = '<span style="color:#38bdf8;">🔄 DB 저장 중...</span>';
        }

        JunctionNotes.state.isSaving = true;

        try {
            const response = await fetch(`/api/sim/junction-notes/${encodeURIComponent(jid)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memo: j.memo || '',
                    calendarEvents: j.calendarEvents || []
                })
            });

            const result = await response.json().catch(() => ({}));
            JunctionNotes.state.lastSavedAt = new Date().toISOString();

            if (statusEl) {
                const timeStr = formatTime(new Date());
                statusEl.innerHTML = `<span style="color:#10b981;">✓ DB 저장 완료 (${timeStr})</span>`;
            }

            if (showFeedback && typeof window.showToast === 'function') {
                window.showToast('교차로 메모 및 캘린더 데이터가 DB에 영구 저장되었습니다.');
            }
        } catch (err) {
            console.error('[JunctionNotes] Save failed:', err);
            if (statusEl) {
                statusEl.innerHTML = '<span style="color:#f59e0b;">⚠️ 로컬 저장 완료 (서버 동기화 지연)</span>';
            }
            if (showFeedback) {
                alert('DB 저장 중 오류가 발생했으나 브라우저 로컬 저장소에 안전하게 보존되었습니다.');
            }
        } finally {
            JunctionNotes.state.isSaving = false;
        }
    }

    /**
     * 메인 렌더링 함수
     */
    function renderJunctionNotesUI() {
        const container = document.getElementById('junction-notes-container');
        if (!container) return;

        const targetId = JunctionNotes.state.jid || window._currentOverlayJid || (window.STATE && window.STATE.activeJid);
        if (!targetId) return;
        JunctionNotes.state.jid = targetId;

        const j = getJunction(targetId);
        if (!j) return;

        const memo = j.memo || '';
        const events = j.calendarEvents || [];
        const state = JunctionNotes.state;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1.25fr; gap: 15px; margin-top: 15px;">
                <!-- 1. 좌측: 교차로 종합 메모 카드 -->
                <div class="sigma-card-notes" style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 14px; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 14px;">📝</span>
                            <span style="font-size: 12px; font-weight: bold; color: #f8fafc;">교차로 운영 종합 메모</span>
                        </div>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <button id="btn-copy-memo" class="btn-xs" style="background: rgba(255,255,255,0.08); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 3px 8px; font-size: 10.5px; cursor: pointer;">📋 복사</button>
                            <button id="btn-save-memo" class="btn-xs" style="background: #059669; color: #fff; border: 1px solid #10b981; border-radius: 4px; padding: 3px 10px; font-size: 10.5px; font-weight: bold; cursor: pointer;">💾 메모 저장</button>
                        </div>
                    </div>
                    
                    <div style="position: relative; flex: 1; display: flex; flex-direction: column;">
                        <textarea id="junction-memo-textarea" 
                            style="width: 100%; min-height: 260px; flex: 1; background: rgba(0,0,0,0.3); color: #f1f5f9; border: 1px solid #334155; border-radius: 4px; padding: 10px; font-size: 11.5px; line-height: 1.6; resize: vertical; box-sizing: border-box; outline: none; font-family: inherit;"
                            placeholder="해당 교차로의 관제 특이사항, 현장 장비(제어기/카메라/감지기) 상태, 인근 공사 및 도로 운영 유의점을 자유롭게 입력하세요. (DB 자동 동기화 지원)">${escapeHtml(memo)}</textarea>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 10px; color: #94a3b8;">
                        <div id="junction-notes-save-status">
                            ${state.lastSavedAt ? `<span style="color:#10b981;">✓ DB 동기화됨 (${state.lastSavedAt.slice(0, 16).replace('T', ' ')})</span>` : '<span>입력 시 자동 임시 보존</span>'}
                        </div>
                        <div id="memo-char-count">${memo.length} 자</div>
                    </div>
                </div>

                <!-- 2. 우측: 캘린더 & 날짜별 운영 이력 카드 -->
                <div class="sigma-card-calendar" style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 14px; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 14px;">📅</span>
                            <span style="font-size: 12px; font-weight: bold; color: #f8fafc;">운영 캘린더 & 날짜별 메모</span>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button id="btn-toggle-view" class="btn-xs" style="background: rgba(255,255,255,0.08); color: #93c5fd; border: 1px solid rgba(147,197,253,0.3); border-radius: 4px; padding: 3px 8px; font-size: 10.5px; cursor: pointer;">
                                ${state.viewMode === 'calendar' ? '📋 전체목록 보기' : '📅 캘린더 보기'}
                            </button>
                        </div>
                    </div>

                    ${state.viewMode === 'calendar' ? renderCalendarView(j) : renderAllEventsListView(j)}
                </div>
            </div>
        `;

        attachEventListeners(j);
    }

    /**
     * 월간 캘린더 뷰 HTML 생성
     */
    function renderCalendarView(j) {
        const state = JunctionNotes.state;
        const year = state.currentYear;
        const month = state.currentMonth; // 0-based
        const events = j.calendarEvents || [];

        // 해당 월의 날짜별 이벤트 집계 맵 (dateStr -> count)
        const eventMap = {};
        events.forEach(ev => {
            if (!ev || !ev.date) return;
            if (!eventMap[ev.date]) eventMap[ev.date] = [];
            eventMap[ev.date].push(ev);
        });

        const firstDay = new Date(year, month, 1).getDay(); // 0(Sun) ~ 6(Sat)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();

        const todayStr = formatDate(new Date());

        let cellsHtml = '';

        // 1) 이전 달 빈칸 (이전 달 날짜 회색 표시)
        for (let i = firstDay - 1; i >= 0; i--) {
            const dayNum = prevMonthDays - i;
            cellsHtml += `<div class="cal-cell cal-cell-prev" style="color: #475569; font-size: 10px; padding: 6px 2px; text-align: center; border-radius: 3px;">${dayNum}</div>`;
        }

        // 2) 이번 달 날짜
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === state.selectedDate;
            const dayEvents = eventMap[dateStr] || [];
            const hasEvents = dayEvents.length > 0;

            let bgStyle = 'transparent';
            let borderStyle = '1px solid transparent';
            let colorStyle = '#e2e8f0';

            const dayOfWeek = (firstDay + d - 1) % 7;
            if (dayOfWeek === 0) colorStyle = '#f87171'; // 일요일 빨강
            if (dayOfWeek === 6) colorStyle = '#60a5fa'; // 토요일 파랑

            if (isSelected) {
                bgStyle = 'rgba(56, 189, 248, 0.2)';
                borderStyle = '1px solid #38bdf8';
            } else if (isToday) {
                borderStyle = '1px solid #10b981';
            }

            // 인디케이터 도트 HTML
            let dotsHtml = '';
            if (hasEvents) {
                dotsHtml = '<div style="display:flex; justify-content:center; gap:2px; margin-top:2px;">';
                const showLimit = Math.min(dayEvents.length, 3);
                for (let k = 0; k < showLimit; k++) {
                    const cat = dayEvents[k].category || '메모';
                    const catCfg = JunctionNotes.categories[cat] || JunctionNotes.categories['메모'];
                    dotsHtml += `<span style="width:4px; height:4px; border-radius:50%; background:${catCfg.border}; display:inline-block;" title="${cat}: ${dayEvents[k].content}"></span>`;
                }
                if (dayEvents.length > 3) {
                    dotsHtml += `<span style="font-size:7px; line-height:5px; color:#38bdf8;">+</span>`;
                }
                dotsHtml += '</div>';
            }

            cellsHtml += `
                <div class="cal-cell cal-cell-day" data-date="${dateStr}" 
                     style="background: ${bgStyle}; border: ${borderStyle}; color: ${colorStyle}; font-size: 10.5px; padding: 4px 2px; text-align: center; border-radius: 4px; cursor: pointer; transition: all 0.15s; min-height: 28px;">
                    <div>${d}</div>
                    ${dotsHtml}
                </div>
            `;
        }

        // 3) 다음 달 빈칸
        const totalRendered = firstDay + daysInMonth;
        const nextMonthDays = (7 - (totalRendered % 7)) % 7;
        for (let n = 1; n <= nextMonthDays; n++) {
            cellsHtml += `<div class="cal-cell cal-cell-next" style="color: #475569; font-size: 10px; padding: 6px 2px; text-align: center; border-radius: 3px;">${n}</div>`;
        }

        // 선택된 일자의 이벤트 목록
        const selectedEvents = eventMap[state.selectedDate] || [];
        const selectedDayOfWeek = getDayOfWeek(state.selectedDate);

        return `
            <!-- 캘린더 상단 월 네비게이션 -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; gap: 4px; align-items: center;">
                    <button id="cal-prev-month" class="btn-xs" style="background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 2px 7px; cursor: pointer;">◀</button>
                    <span style="font-size: 12px; font-weight: bold; color: #f8fafc; min-width: 100px; text-align: center;">${year}년 ${month + 1}월</span>
                    <button id="cal-next-month" class="btn-xs" style="background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 2px 7px; cursor: pointer;">▶</button>
                </div>
                <button id="cal-today-btn" class="btn-xs" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid #10b981; border-radius: 3px; padding: 2px 8px; font-size: 10px; cursor: pointer;">오늘</button>
            </div>

            <!-- 요일 헤더 -->
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 10px; font-weight: bold; color: #94a3b8; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                <div style="color: #f87171;">일</div>
                <div>월</div>
                <div>화</div>
                <div>수</div>
                <div>목</div>
                <div>금</div>
                <div style="color: #60a5fa;">토</div>
            </div>

            <!-- 날짜 그리드 -->
            <div id="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">
                ${cellsHtml}
            </div>

            <!-- 선택된 날짜 메모/이력 영역 -->
            <div style="margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; flex: 1; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-size: 11px; font-weight: bold; color: #38bdf8;">
                        📌 ${state.selectedDate} (${selectedDayOfWeek}) 일자 메모 (${selectedEvents.length}건)
                    </div>
                </div>

                <!-- 빠른 등록 폼 -->
                <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                    <select id="cal-input-cat" style="background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 4px; font-size: 10.5px; padding: 3px 6px; outline: none;">
                        <option value="점검">점검</option>
                        <option value="신호">신호변경</option>
                        <option value="보수">시설보수</option>
                        <option value="민원">민원</option>
                        <option value="메모" selected>일반메모</option>
                    </select>
                    <input type="text" id="cal-input-time" value="${formatTime(new Date())}" style="width: 48px; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 4px; font-size: 10.5px; padding: 3px 4px; text-align: center;" placeholder="HH:mm">
                    <input type="text" id="cal-input-text" style="flex: 1; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 4px; font-size: 10.5px; padding: 3px 8px;" placeholder="해당 날짜의 운영/점검 메모 입력">
                    <button id="cal-btn-add" class="btn-xs" style="background: #0284c7; color: #fff; border: 1px solid #38bdf8; border-radius: 4px; padding: 3px 10px; font-size: 10.5px; font-weight: bold; cursor: pointer; white-space: nowrap;">➕ 등록</button>
                </div>

                <!-- 이벤트 리스트 스크롤 영역 -->
                <div class="custom-scroll" style="max-height: 140px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                    ${selectedEvents.length === 0 ? `
                        <div style="text-align: center; color: #64748b; font-size: 10.5px; padding: 15px 0;">
                            등록된 일자별 메모가 없습니다. 위 입력창에서 내용을 추가하세요.
                        </div>
                    ` : selectedEvents.map(ev => renderEventItemHtml(ev)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * 단일 이벤트 행 HTML
     */
    function renderEventItemHtml(ev) {
        const cat = ev.category || '메모';
        const cfg = JunctionNotes.categories[cat] || JunctionNotes.categories['메모'];
        return `
            <div class="cal-event-item" style="display: flex; justify-content: space-between; align-items: flex-start; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 5px 8px; font-size: 10.5px;">
                <div style="display: flex; gap: 6px; align-items: baseline; flex: 1;">
                    <span style="font-size: 9.5px; padding: 1px 5px; border-radius: 3px; background: ${cfg.bg}; border: 1px solid ${cfg.border}; color: ${cfg.color}; font-weight: bold; white-space: nowrap;">${cfg.label}</span>
                    ${ev.time ? `<span style="color: #94a3b8; font-size: 9.5px;">${ev.time}</span>` : ''}
                    <span style="color: #f1f5f9; flex: 1; word-break: break-all;">${escapeHtml(ev.content)}</span>
                </div>
                <button class="btn-del-event" data-id="${ev.id}" style="background: transparent; border: none; color: #ef4444; font-size: 10px; cursor: pointer; padding: 0 2px; margin-left: 6px;" title="삭제">✕</button>
            </div>
        `;
    }

    /**
     * 전체 일자별 이력 모아보기 리스트 뷰
     */
    function renderAllEventsListView(j) {
        const events = [...(j.calendarEvents || [])];
        // 최신 날짜 및 시간순 정렬
        events.sort((a, b) => {
            const dateCmp = (b.date || '').localeCompare(a.date || '');
            if (dateCmp !== 0) return dateCmp;
            return (b.time || '').localeCompare(a.time || '');
        });

        return `
            <div style="flex: 1; display: flex; flex-direction: column;">
                <div style="font-size: 11px; font-weight: bold; color: #93c5fd; margin-bottom: 8px;">
                    📜 전체 운영 일자별 메모 및 작업 이력 (총 ${events.length}건)
                </div>
                <div class="custom-scroll" style="max-height: 330px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                    ${events.length === 0 ? `
                        <div style="text-align: center; color: #64748b; font-size: 11px; padding: 30px 0;">
                            등록된 교차로 이력 데이터가 없습니다.
                        </div>
                    ` : events.map(ev => {
                        const cat = ev.category || '메모';
                        const cfg = JunctionNotes.categories[cat] || JunctionNotes.categories['메모'];
                        return `
                            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 6px 10px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; gap: 8px; align-items: center; flex: 1;">
                                    <span style="color: #38bdf8; font-weight: bold; font-size: 10px;">${ev.date}</span>
                                    ${ev.time ? `<span style="color: #94a3b8; font-size: 10px;">${ev.time}</span>` : ''}
                                    <span style="font-size: 9px; padding: 1px 5px; border-radius: 3px; background: ${cfg.bg}; border: 1px solid ${cfg.border}; color: ${cfg.color}; font-weight: bold;">${cfg.label}</span>
                                    <span style="color: #f1f5f9; flex: 1; word-break: break-all;">${escapeHtml(ev.content)}</span>
                                </div>
                                <button class="btn-del-event" data-id="${ev.id}" style="background: transparent; border: none; color: #ef4444; font-size: 11px; cursor: pointer; padding: 0 4px;" title="삭제">✕</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * 이벤트 리스너 바인딩
     */
    function attachEventListeners(j) {
        const jid = JunctionNotes.state.jid;

        // 1) 종합 메모 Textarea 입력 이벤트 (디바운스 자동 로컬 보존)
        const memoEl = document.getElementById('junction-memo-textarea');
        if (memoEl) {
            memoEl.addEventListener('input', (e) => {
                j.memo = e.target.value;
                const charCountEl = document.getElementById('memo-char-count');
                if (charCountEl) charCountEl.textContent = `${j.memo.length} 자`;

                const statusEl = document.getElementById('junction-notes-save-status');
                if (statusEl) statusEl.innerHTML = '<span style="color:#f59e0b;">● 수정 중 (임시 저장됨)</span>';

                clearTimeout(JunctionNotes.state.debounceTimer);
                JunctionNotes.state.debounceTimer = setTimeout(() => {
                    saveToLocalCache(jid, j);
                }, 800);
            });
        }

        // 2) 메모 저장 버튼 클릭 (DB 영구 저장)
        const btnSaveMemo = document.getElementById('btn-save-memo');
        if (btnSaveMemo) {
            btnSaveMemo.addEventListener('click', () => {
                saveJunctionNotesToDB(true);
            });
        }

        // 3) 메모 복사 버튼
        const btnCopyMemo = document.getElementById('btn-copy-memo');
        if (btnCopyMemo) {
            btnCopyMemo.addEventListener('click', () => {
                if (memoEl && memoEl.value) {
                    navigator.clipboard.writeText(memoEl.value).then(() => {
                        alert('메모 내용이 클립보드에 복사되었습니다.');
                    }).catch(() => {
                        memoEl.select();
                        document.execCommand('copy');
                        alert('메모 내용이 클립보드에 복사되었습니다.');
                    });
                } else {
                    alert('복사할 메모 내용이 없습니다.');
                }
            });
        }

        // 4) 뷰 전환 토글 (캘린더 ↔ 전체목록)
        const btnToggleView = document.getElementById('btn-toggle-view');
        if (btnToggleView) {
            btnToggleView.addEventListener('click', () => {
                JunctionNotes.state.viewMode = JunctionNotes.state.viewMode === 'calendar' ? 'list' : 'calendar';
                renderJunctionNotesUI();
            });
        }

        // 5) 캘린더 네비게이션
        const btnPrevMonth = document.getElementById('cal-prev-month');
        if (btnPrevMonth) {
            btnPrevMonth.addEventListener('click', () => {
                let m = JunctionNotes.state.currentMonth - 1;
                let y = JunctionNotes.state.currentYear;
                if (m < 0) {
                    m = 11;
                    y -= 1;
                }
                JunctionNotes.state.currentMonth = m;
                JunctionNotes.state.currentYear = y;
                renderJunctionNotesUI();
            });
        }

        const btnNextMonth = document.getElementById('cal-next-month');
        if (btnNextMonth) {
            btnNextMonth.addEventListener('click', () => {
                let m = JunctionNotes.state.currentMonth + 1;
                let y = JunctionNotes.state.currentYear;
                if (m > 11) {
                    m = 0;
                    y += 1;
                }
                JunctionNotes.state.currentMonth = m;
                JunctionNotes.state.currentYear = y;
                renderJunctionNotesUI();
            });
        }

        const btnToday = document.getElementById('cal-today-btn');
        if (btnToday) {
            btnToday.addEventListener('click', () => {
                const now = new Date();
                JunctionNotes.state.currentYear = now.getFullYear();
                JunctionNotes.state.currentMonth = now.getMonth();
                JunctionNotes.state.selectedDate = formatDate(now);
                renderJunctionNotesUI();
            });
        }

        // 6) 캘린더 날짜 클릭
        document.querySelectorAll('.cal-cell-day').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const d = target.getAttribute('data-date');
                if (d) {
                    JunctionNotes.state.selectedDate = d;
                    renderJunctionNotesUI();
                }
            });
        });

        // 7) 일자별 메모 항목 추가
        const btnAdd = document.getElementById('cal-btn-add');
        const textInput = document.getElementById('cal-input-text');
        const catInput = document.getElementById('cal-input-cat');
        const timeInput = document.getElementById('cal-input-time');

        const handleAddEvent = () => {
            if (!textInput || !textInput.value.trim()) {
                alert('메모 내용을 입력하세요.');
                if (textInput) textInput.focus();
                return;
            }

            const newEvent = {
                id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                date: JunctionNotes.state.selectedDate,
                time: timeInput ? timeInput.value.trim() : formatTime(new Date()),
                category: catInput ? catInput.value : '메모',
                content: textInput.value.trim(),
                createdAt: new Date().toISOString()
            };

            if (!j.calendarEvents) j.calendarEvents = [];
            j.calendarEvents.push(newEvent);

            // DB 저장 및 UI 갱신
            saveJunctionNotesToDB(false);
            renderJunctionNotesUI();
        };

        if (btnAdd) {
            btnAdd.addEventListener('click', handleAddEvent);
        }
        if (textInput) {
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEvent();
                }
            });
        }

        // 8) 항목 삭제 클릭
        document.querySelectorAll('.btn-del-event').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const evId = e.currentTarget.getAttribute('data-id');
                if (!evId) return;
                if (!confirm('해당 날짜별 메모 항목을 삭제하시겠습니까?')) return;

                j.calendarEvents = (j.calendarEvents || []).filter(ev => ev.id !== evId);
                saveJunctionNotesToDB(false);
                renderJunctionNotesUI();
            });
        });
    }

    /** HTML 특수문자 이스케이프 */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 전역 노출 API
    window.renderJunctionNotes = function (jid) {
        if (!jid) return;
        loadJunctionNotes(jid);
    };

    window.saveActiveJunctionNotesToDB = function () {
        return saveJunctionNotesToDB(true);
    };

    // 자동 DOM 감지 및 초기화 리스너 (교차로정보 탭 활성화 시 무조건 렌더링 보장)
    function setupTabObserver() {
        const baseTab = document.getElementById('overlay-tab-baseinfo');
        if (!baseTab) {
            setTimeout(setupTabObserver, 500);
            return;
        }

        const checkAndRender = () => {
            if (baseTab.style.display !== 'none') {
                const container = document.getElementById('junction-notes-container');
                if (container && (!container.innerHTML || container.innerHTML.trim() === '')) {
                    const currentJid = window._currentOverlayJid || (window.STATE && window.STATE.activeJid);
                    if (currentJid) {
                        loadJunctionNotes(currentJid);
                    }
                }
            }
        };

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    checkAndRender();
                }
            });
        });

        observer.observe(baseTab, { attributes: true });

        // 탭 버튼 클릭 이벤트 직접 보강
        const tabBtn = document.getElementById('tab-btn-baseinfo');
        if (tabBtn) {
            tabBtn.addEventListener('click', () => {
                setTimeout(checkAndRender, 50);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupTabObserver);
    } else {
        setupTabObserver();
    }

    window.JunctionNotes = JunctionNotes;

})(window);

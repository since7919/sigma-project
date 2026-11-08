# SIGMA 프로젝트 개발 및 유지보수 규칙 (Workspace Rule)

> **적용 대상:** 본 프로젝트의 모든 신규 대화 세션 및 유지보수 에이전트  
> **최우선 참조 문서:** [`SIGMA_ARCHITECTURE.md`](file:///c:/Users/since/OneDrive/바탕%20화면/SIGMA/SIGMA_ARCHITECTURE.md)

---

## 1. 아키텍처 인지 및 시스템 파악 원칙
1. 작업 시작 시 반드시 루트의 [`SIGMA_ARCHITECTURE.md`](file:///c:/Users/since/OneDrive/바탕%20화면/SIGMA/SIGMA_ARCHITECTURE.md)를 참조하여 파일별 역할, 전역 `STATE` 구조, 3단계 로딩 라이프사이클을 확인한 후 작업하십시오.
2. `SIGMA_SIM`의 핵심 상태는 `window.STATE` 단일 객체로 집중 관리되며, 42개 JS 모듈이 7개 기능 클러스터로 분리되어 있습니다.

---

## 2. 코드 변경 및 파일 유지보수 규칙
1. **대형 파일 비대화 금지 (단일 책임 원칙)**:
   - [`data.js`](file:///c:/Users/since/OneDrive/바탕%20화면/SIGMA/SIGMA_SIM/js/data.js)와 [`stats.js`](file:///c:/Users/since/OneDrive/바탕%20화면/SIGMA/SIGMA_SIM/js/stats.js)에 임의로 거대 기능을 누적하지 마십시오.
   - 새로운 독립 기능은 [`ai_report.js`](file:///c:/Users/since/OneDrive/바탕%20화면/SIGMA/SIGMA_SIM/js/ai_report.js), [`insight_modal.js`](file:///c:/Users/since/OneDrive/바탕%20화면/SIGMA/SIGMA_SIM/js/insight_modal.js)처럼 별도 모듈로 분리하고 [`index.html`](file:///c:/Users/since/OneDrive/바탕%20화면/SIGMA/SIGMA_SIM/index.html)에 스크립트 태그를 등록하십시오.
2. **교차로 삭제/수정 시 4중 캐시 무효화 준수**:
   - `STATE.junctions` 메모리 삭제
   - 백엔드 `/api/sim/delete-junction` (외래키 종속 테이블 선별 삭제 및 서버 CSV 캐시 갱신)
   - `SigmaIDB.deleteJunction(jid)` (IndexedDB 영구 삭제)
   - `caches.open('sigma-data-cache')` (브라우저 Cache API 인크리멘탈 행 제거)
3. **API 키 및 비밀번호 보호 (GitHub Push Protection 준수)**:
   - 일회성 테스트 스크립트나 코드 내에 실제 API Key(Groq, Gemini, Supabase 등)를 직접 하드코딩하지 마십시오.
   - 임시 작업 스크립트는 `archive/patch_history/`에 작성하여 원격 저장소에 푸시되지 않도록 격리하십시오.
4. **문법 및 무결성 사전 검증**:
   - JS 파일 수정 후 반드시 `node --check <file>`을 통해 구문 오류가 없음을 검증한 후 커밋/푸시하십시오.

---

## 3. 답변 및 커뮤니케이션 스타일
- 모든 답변은 정제되고 전문가다운 한국어로 작성하십시오.
- 모든 답변은 핵심 요약 위주로 간결하게 제시하십시오.
- 파일 및 코드 참조 시 반드시 `file:///` 형식의 클릭 가능한 마크다운 링크를 제공하십시오.

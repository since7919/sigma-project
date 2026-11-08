# SIGMA - 스마트 교통신호 운영 관리 및 시뮬레이션 시스템

SIGMA(Signal Information & Group Management Architecture)는 대규모 도시 교통신호망(서울시 3,600+ 교차로 포함 24개 지자체)의 신호운영, 연동제어(TSD), 거시/미시 통계 분석 및 AI 리포트 생성을 지원하는 웹 기반 교통 엔지니어링 플랫폼입니다.

---

## 📌 시스템 구조 및 아키텍처 문서

새로운 개발 세션을 시작하거나 코드 유지보수/리팩토링을 수행할 때는 반드시 아래 아키텍처 문서를 먼저 참조하십시오:

👉 **[SIGMA 시스템 전체 구조도 및 모듈 명세서 (SIGMA_ARCHITECTURE.md)](file:///c:/Users/since/OneDrive/바탕%20화면/SIGMA/SIGMA_ARCHITECTURE.md)**

본 문서에는 다음 내용이 상세히 기록되어 있습니다:
- **전역 토폴로지**: Leaflet SPA, IndexedDB, Cache API, Express Backend, Supabase RDB, AI 엔진 간 데이터 파이프라인
- **모듈 맵**: `SIGMA_SIM/js/` 내 42개 전 모듈의 기능적 분류(7개 클러스터) 및 핵심 함수 명세
- **상태 관리**: 단일 반응형 전역 객체 `STATE`의 구조와 생명주기
- **성능 및 캐시 파이프라인**: 3단계 점진적 데이터 로딩(Fast-First Loading) 및 무결성 보장 규칙

---

## 🚀 빠른 시작

1. **시뮬레이터(클라이언트) 실행**:
   - `SIGMA_SIM/index.html`을 최신 웹 브라우저(Chrome 권장)에서 실행합니다.
2. **백엔드 API 서버 실행**:
   ```bash
   cd SIGMA_API/sigma-backend
   npm install
   node app.js
   ```

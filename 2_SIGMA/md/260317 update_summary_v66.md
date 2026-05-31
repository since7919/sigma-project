# 🚦 신호등화 대시보드 V66 업데이트 작업 요약

본 문서는 이번 세션 동안 수행된 신호등화 대시보드 시스템의 주요 업데이트 및 개선 사항을 정리한 것입니다.

## 1. 🏹 신호 화살표 배치 최적화
보행 신호의 시인성을 높이기 위해 초기 배치 로직을 개선했습니다.
- **보행 신호(101-108) 위치 조정**: 대응하는 차량 신호(1-8)를 기준으로 좌/우로 번갈아가며 오프셋(+/- 22도)을 부여하여 중첩을 방지했습니다.
- **초기화 로직 반영**: '신호등 초기화' 버튼 실행 시에도 변경된 배치 로직이 적용되도록 [resetArrowPositions](file:///c:/Users/since/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/260314%20%EC%8B%A0%ED%98%B8%EB%93%B1%ED%99%94%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C_V66%28%EC%83%81%EC%84%B8%ED%86%B5%EA%B3%84%EC%A0%95%EB%A0%AC%EB%A7%A4%EB%89%B4%EC%96%BC%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8%29/js/junction.js#448-457) 함수를 업데이트했습니다.

## 2. 📊 Phase/Split 탭 UI 및 편의 기능 개선
사용자 편의를 위해 설정 테이블의 노출 방식을 세분화했습니다.
- **듀얼링 가변 표시**: `TOD 및 신호시간(Split) 설정` 테이블에서 'Dual(각각입력)' 체크박스가 해제된 경우 B링 행을 숨겨 UI를 단순화했습니다.
- **현시 정보 상시 노출**: `현시 계획(Map) 설정` 테이블은 링 구성 파악을 위해 항상 A/B링을 모두 표시하도록 설정했습니다.
- **요일별 TOD 복사 기능 강화**: 시작시간, 주기, 연동값, 스플릿 등 모든 운영 데이터를 한꺼번에 복사하도록 개선했으며, 그룹 연동 시 그룹 스케줄을 우선 참조하도록 수정했습니다.

## 🔄 데이터 동기화 및 안정성 확보
모드 전환 및 입력 시 데이터 유실을 방지하고 정합성을 높였습니다.
- **실시간 저장 대상 분리**: Split 데이터는 TOD 플랜에, 부가 시간(황색, 전적색 등)은 시차맵(Signal Map)에 저장되도록 구조를 최적화했습니다.
- **강제 동기화(Proactive Sync)**: 싱글 모드 운영 시 B링 데이터를 A링과 실시간으로 강제 동기화하여, 듀얼 모드 전환 시에도 입력값이 유실되지 않고 유지되도록 조치했습니다.
- **동기화 항목 확대**: 전적색, 황색, 보행전, 보행시간 등 모든 신호 시간 파라미터에 대해 자동 동기화 로직을 적용했습니다.

## 🛠️ 주요 수정 파일 목록
| 파일명 | 주요 수정 내용 |
| :--- | :--- |
| [index.html](file:///c:/Users/since/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/260314%20%EC%8B%A0%ED%98%B8%EB%93%B1%ED%99%94%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C_V66%28%EC%83%81%EC%84%B8%ED%86%B5%EA%B3%84%EC%A0%95%EB%A0%AC%EB%A7%A4%EB%89%B4%EC%96%BC%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8%29/index.html) | 로그인 시스템 임시 숨김, 체크박스 이벤트 연동 |
| [js/junction.js](file:///c:/Users/since/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/260314%20%EC%8B%A0%ED%98%B8%EB%93%B1%ED%99%94%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C_V66%28%EC%83%81%EC%84%B8%ED%86%B5%EA%B3%84%EC%A0%95%EB%A0%AC%EB%A7%A4%EB%89%B4%EC%96%BC%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8%29/js/junction.js) | 보행 신호 화살표 초기 위치 및 리셋 로직 수정 |
| [js/phase.js](file:///c:/Users/since/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/260314%20%EC%8B%A0%ED%98%B8%EB%93%B1%ED%99%94%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C_V66%28%EC%83%81%EC%84%B8%ED%86%B5%EA%B3%84%EC%A0%95%EB%A0%AC%EB%A7%A4%EB%89%B4%EC%96%BC%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8%29/js/phase.js) | 테이블 렌더링 필터링, 데이터 마이그레이션, 복사 로직 개선 |
| [js/table_logic.js](file:///c:/Users/since/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/260314%20%EC%8B%A0%ED%98%B8%EB%93%B1%ED%99%94%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C_V66%28%EC%83%81%EC%84%B8%ED%86%B5%EA%B3%84%EC%A0%95%EB%A0%AC%EB%A7%A4%EB%89%B4%EC%96%BC%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8%29/js/table_logic.js) | 입력 성능 최적화 및 A/B링 실시간 동기화 로직 추가 |
| [js/data.js](file:///c:/Users/since/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/260314%20%EC%8B%A0%ED%98%B8%EB%93%B1%ED%99%94%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C_V66%28%EC%83%81%EC%84%B8%ED%86%B5%EA%B3%84%EC%A0%95%EB%A0%AC%EB%A7%A4%EB%89%B4%EC%96%BC%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8%29/js/data.js) | CSV 빌드 과정의 구문 오류 수정 및 필드 분할 처리 |
| [Sigma_Manual.html](file:///c:/Users/since/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/260314%20%EC%8B%A0%ED%98%B8%EB%93%B1%ED%99%94%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C_V66%28%EC%83%81%EC%84%B8%ED%86%B5%EA%B3%84%EC%A0%95%EB%A0%AC%EB%A7%A4%EB%89%B4%EC%96%BC%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8%29/Sigma_Manual.html) | 필드 정의 및 메뉴얼 업데이트 |

---
> [!NOTE]
> 모든 변경 사항은 현재 시스템에 적용 완료되었으며, '변경사항 적용' 버튼을 통해 최종 저장 후 테스트를 진행해 주시기 바랍니다.

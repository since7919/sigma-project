/**
 * config.js
 * ─────────────────────────────────────────────
 * 앱 전역 설정, 상태 객체, 공유 상수 및 팩토리 함수
 * 모든 JS 파일에서 참조하므로 반드시 가장 먼저 로드해야 합니다.
 */

/* ── 앱 설정 상수 ── */
const CONFIG = {
    MIN_ZOOM_FOR_ARROWS: 15,
    MIN_ZOOM_FOR_TEXT: 14,
    BASE_SPEED: 4,
    DEFAULT_LATLNG: [37.570975, 126.977759],
    CYCLE_COLORS: {
        60: "#1abc9c", 70: "#2ecc71", 80: "#3498db", 90: "#9b59b6",
        100: "#f1c40f", 120: "#e67e22", 140: "#e74c3c", 160: "#ff6b6b",
        180: "#feca57", 200: "#48dbfb"
    },
    APP_MODE: {
        SELECT: "SELECT",               // 기본: 교차로 선택 및 인터랙션
        NETWORK_EDIT: "NETWORK_EDIT",   // 연동망(링크) 편집 모드
        MAP_EDIT: "MAP_EDIT",           // 지도 편집(신호등/교차로 위치)
        ADD_NODE: "ADD_NODE"            // 교차로 추가 모드
    }
};

/** ── CSV 최적화용 체크박스 인덱스 마이그레이션 맵 ── */
const OP_MASTER_KEYS = {
    // 교차로 전체 속성 (Global)
    GLOBAL: [
        'app-1', 'app-3', 'app-4', 'app-5', 'app-6plus',
        'zone-child', 'zone-old', 'zone-disabled',
        'ped-diagonal', 'ped-full', 'ped-time', 'ped-two', 'ped-lag', 'ped-lpi', 'ped-multi',
        'flash-full', 'flash-time', 'flash-etc',
        'emg-st', 'emg-tr',
        'etc-r1', 'etc-r2', 'etc-r3'
    ],
    // 방향별 속성 (Directional - Boolean Flags Only)
    DIR_FLAGS: (() => {
        const f = [];
        // [20대] 보호구역 및 횡단보도 시설
        f[21] = 'cwChild';      // 어린이 보호구역
        f[22] = 'cwOld';        // 노인 보호구역
        f[23] = 'cwDis';        // 장애인 보호구역
        f[24] = 'cwDiag';       // 대각선 횡단
        f[25] = 'cwTwo';        // 이단 횡단
        f[26] = 'trafficIsland'; // 교통섬

        // [30대] 보조 신호 및 잔여시간 표시기
        f[31] = 'residRed';     // 잔여_적색
        f[32] = 'residGreen';   // 잔여_녹색
        f[33] = 'auxA';         // 보조등_좌
        f[34] = 'auxB';         // 보조등_우
        f[35] = 'floorSig';     // 바닥신호

        // [40대] 좌회전 운영
        f[41] = 'leftProt';      // 보호 좌회전
        f[42] = 'leftUnprot';    // 비보호 좌회전
        f[43] = 'leftPplt';      // PPLT
        f[44] = 'leftPdlt';      // PDLT
        f[45] = 'leftTurnSimul'; // 직좌 동시신호
        f[46] = 'leftLeadLag';   // 좌회전 선/후행
        f[47] = 'uTurnSig';      // 유턴 신호

        // [50대] 우회전 운영
        f[51] = 'rightOnly';     // 우회전 전용
        f[52] = 'rightChannel';  // 우회전 도류화

        // [60대] 보행 세부 운영
        f[61] = 'pedEarly';      // 보행조기
        f[62] = 'pedLpi';        // 보행 LPI
        f[63] = 'spd07';         // 0.7m/s (설계속도)
        f[64] = 'pedExt';        // 보행연장
        f[65] = 'pedMulti';      // 보행중복
        f[66] = 'pedSimul';      // 보행동시
        f[67] = 'autoExt';       // 자동연장
        f[68] = 'pedLagActive';  // 보행시차(Lag)

        // [80대] 기타 및 감응/소통 관련 (기존 항목 유지용)
        f[81] = 'rightSig';      f[82] = 'rightAux';
        f[83] = 'actSkip';       f[84] = 'actEarly';      f[85] = 'actMax';
        f[86] = 'actLeadL';      f[87] = 'actLeadS';
        f[88] = 'spaceWait';     f[89] = 'spaceCongest';
        return f;
    })(),
    // 라디오 버튼 옵션 맵 (이름: [옵션들...])
    RADIO_MAPS: {
        'actType_left': ['none', '생략', '조기', '기타'],
        'actType_grid': ['none', '대기검지', '앞막힘제어', '기타'],
        'actType_ped': ['none', '주기유지', '예약등화']
    }
};

/* ── 앱 전역 상태 ── */
const STATE = {
    appMode: "SELECT", // 초기 모드: SELECT
    junctions: {},
    activeJid: null,
    selectedJids: [], // [New] 선택된 교차로들 (다중 선택 대응)
    isAddMode: false,
    showSignalArrows: false,
    showCycleColors: false,
    showJunctionNames: false,
    showJunctionCycles: false,
    nodeScale: 0.5,
    arrowScale: 1.5,
    simTimer: null,
    currentSpeedScale: 1,
    currentTheme: 'dark',
    groups: {},
    currentGroupDayTypeIdx: 0,   // 0:평일 1:금 2:토 3:일 4:특수
    selectedTodPlanIdx: 0,       // 시공도 분석 대상 시간계획 인덱스 (0~15)
    currentJunctionDayTypeIdx: 0,
    isConfigEditing: true,
    geoJsonLayer: null,
    highlightedGroupId: null, // [New] 연동 그룹 GeoJSON 클릭 시 선택된 그룹 ID
    // 툴팁 표시 관련
    showId: false,
    showName: true,
    showSeq: false,
    showPolice: false,
    showOffice: false,
    showCycle: false,
    showLatLng: false,
    showGroup: false,
    showOffset: false,
    // 운영통계
    isOpStatsExpanded: false,
    opStatsFolded: {},
    opStatsColBMap: {},
    jStatsFolded: {},
    // 편집 모드
    isMapEditMode: false,
    focusedArrow: null,
    showAllTooltips: false,
    // 민원 통계
    civilData: [],
    civilDataByJid: {},
    civilHeaders: [],
    civilPieChart: null,
    showCivilMap: false,
    civilClusterLayer: null,
    civilHighlightLayer: null,
    // 파일 핸들/경로 관리 (업데이트 및 새 이름 저장용)
    fileHandles: {
        intersections: { handle: null, name: 'db_intersections.csv' },
        signalMaps: { handle: null, name: 'db_signal_maps.csv' },
        todPlans: { handle: null, name: 'db_tod_plans.csv' },
        group: { handle: null, name: 'db_groups.csv' },
        stats: { handle: null, name: 'db_stats.csv' },
        civil: { handle: null, name: null }
    },
    currentSignalMapIdx: 0,
    isManualPlanView: false, // [New] 계획 번호를 수동으로 고정해서 볼 때 true
    loadedFiles: { inter:null, maps:null, plans:null, groups:null, stats:null, links:null }
};

/* ── 메모리 캐시 (대규모 교차로 대비) ── */
const MEM_CACHE = {
    emptyPlan: null,
    emptySched: null
};

/* ── 공유 상수 (중복 제거) ── */
const DAY_LABELS = [
    "일계획 1", "일계획 2", "일계획 3", "일계획 4", "일계획 5",
    "일계획 6", "일계획 7", "일계획 8", "일계획 9", "일계획 10"
];
const DAY_COLORS = [
    "#f1c40f", "#1abc9c", "#e67e22", "#e84393", "#a29bfe",
    "#00d4ff", "#ff4757", "#2ecc71", "#9b59b6", "#ffa502"
];
const DAY_COLORS_LIGHT = [
    "rgba(241,196,15,0.1)", "rgba(26,188,156,0.1)",
    "rgba(230,126,34,0.1)", "rgba(232,67,147,0.1)",
    "rgba(162,155,254,0.1)",
    "rgba(0,212,255,0.1)", "rgba(255,71,87,0.1)",
    "rgba(46,204,113,0.1)", "rgba(155,89,182,0.1)",
    "rgba(255,165,2,0.1)"
];

/* ── 팩토리 함수 (5곳 이상 중복 → 단일 소스) ── */

/** 16개 빈 플랜 배열 생성 */
function createEmptyPlans() {
    return Array.from({ length: 16 }, () => ({
        offset: 0,
        splitA: [25, 25, 25, 25, 0, 0, 0, 0],
        splitB: [25, 25, 25, 25, 0, 0, 0, 0],
        yellowA: [3, 3, 3, 3, 0, 0, 0, 0],
        yellowB: [3, 3, 3, 3, 0, 0, 0, 0],
        allredA: [2, 2, 2, 2, 0, 0, 0, 0],
        allredB: [2, 2, 2, 2, 0, 0, 0, 0],
        pedA: [0, 15, 0, 15, 0, 0, 0, 0],
        pedB: [0, 15, 0, 15, 0, 0, 0, 0],
        pedDelayA: [0, 2, 0, 2, 0, 0, 0, 0],
        pedDelayB: [0, 2, 0, 2, 0, 0, 0, 0],
        opMode: 0
    }));
}

/** 16개 빈 스케줄 배열 생성 */
function createEmptySched() {
    return Array.from({ length: 16 }, (_, k) => ({
        h: k === 0 ? 0 : -1, m: 0, cycle: 100
    }));
}

/** 캐시된 빈 플랜 (Deep Copy 반환) */
function getSharedEmptyPlan() {
    if (!MEM_CACHE.emptyPlan) {
        MEM_CACHE.emptyPlan = createEmptyPlans();
    }
    return JSON.parse(JSON.stringify(MEM_CACHE.emptyPlan));
}

/** 캐시된 빈 스케줄 (Deep Copy 반환) */
function getSharedEmptySched() {
    if (!MEM_CACHE.emptySched) {
        MEM_CACHE.emptySched = createEmptySched();
    }
    return JSON.parse(JSON.stringify(MEM_CACHE.emptySched));
}

/** 단일 빈 시차맵 객체 생성 */
function createEmptySignalMap() {
    return {
        movA: [0, 0, 0, 0, 0, 0, 0, 0], movB: [0, 0, 0, 0, 0, 0, 0, 0],
        pedMovA: [0, 0, 0, 0, 0, 0, 0, 0], pedMovB: [0, 0, 0, 0, 0, 0, 0, 0],
        mainMovements: ['A0', 'B0'],
        yellowA: [3, 3, 3, 3, 0, 0, 0, 0], yellowB: [3, 3, 3, 3, 0, 0, 0, 0],
        allredA: [2, 2, 2, 2, 0, 0, 0, 0], allredB: [2, 2, 2, 2, 0, 0, 0, 0],
        pedA: [0, 0, 0, 0, 0, 0, 0, 0], pedB: [0, 0, 0, 0, 0, 0, 0, 0],
        pedDelayA: [0, 0, 0, 0, 0, 0, 0, 0], pedDelayB: [0, 0, 0, 0, 0, 0, 0, 0],
        startTime: "", endTime: ""
    };
}

/** 10개 빈 시차맵 배열 생성 */
function createEmptySignalMaps() {
    return Array.from({ length: 10 }, (_, i) => ({
        movA: i === 0 ? [6, 5, 8, 7, 0, 0, 0, 0] : [0,0,0,0,0,0,0,0],
        movB: i === 0 ? [2, 1, 4, 3, 0, 0, 0, 0] : [0,0,0,0,0,0,0,0],
        pedMovA: i === 0 ? [106, 105, 108, 107, 0, 0, 0, 0] : [0,0,0,0,0,0,0,0],
        pedMovB: i === 0 ? [102, 101, 104, 103, 0, 0, 0, 0] : [0,0,0,0,0,0,0,0],
        mainMovements: ['A0', 'B0'],
        yellowA: [3, 3, 3, 3, 0, 0, 0, 0], yellowB: [3, 3, 3, 3, 0, 0, 0, 0],
        allredA: [2, 2, 2, 2, 0, 0, 0, 0], allredB: [2, 2, 2, 2, 0, 0, 0, 0],
        pedA: [0, 15, 0, 15, 0, 0, 0, 0], pedB: [0, 15, 0, 15, 0, 0, 0, 0],
        pedDelayA: [0, 2, 0, 2, 0, 0, 0, 0], pedDelayB: [0, 2, 0, 2, 0, 0, 0, 0],
        startTime: "", endTime: ""
    }));
}

/** 새 교차로용 기본 플랜 캐시 (10개 TOD 및 시차맵 확장) */
const DEFAULT_PLAN_CACHE = {
    dayPlans: Array.from({ length: 10 }, () => createEmptyPlans()),
    schedules: Array.from({ length: 10 }, () => createEmptySched()),
    signalMaps: createEmptySignalMaps()
};

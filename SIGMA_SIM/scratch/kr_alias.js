const fs = require('fs');
const path = require('path');

const jsonPath = path.join(process.cwd(), 'AI_Core', 'alias_dictionary.json');
let dict = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Common UI English to Korean mappings
const krMap = {
    'btn': ['버튼', '클릭', '단추'],
    'export': ['내보내기', '추출', '저장', '다운로드'],
    'import': ['가져오기', '불러오기', '업로드'],
    'csv': ['CSV파일', '엑셀형식'],
    'map': ['지도', '맵', '화면'],
    'layer': ['레이어', '계층', '표시'],
    'node': ['노드', '교차로'],
    'link': ['링크', '구간', '도로'],
    'poly': ['폴리곤', '경계', '행정구역'],
    'group': ['그룹', '연동그룹', '연동망'],
    'sim': ['시뮬레이션', '재생'],
    'play': ['시작', '플레이'],
    'pause': ['일시정지', '멈춤'],
    'stop': ['정지', '종료'],
    'tick': ['프레임', '틱'],
    'speed': ['속도', '빠르기'],
    'up': ['증가', '올림'],
    'down': ['감소', '내림'],
    'zoom': ['줌', '배율'],
    'in': ['확대'],
    'out': ['축소'],
    'center': ['가운데', '중심이동'],
    'theme': ['테마', '스킨'],
    'dark': ['다크', '어두운'],
    'light': ['라이트', '밝은'],
    'yearbook': ['연보', '통계연보'],
    'civil': ['민원', '불편사항'],
    'score': ['점수', '평가'],
    'safety': ['안전'],
    'accident': ['사고'],
    'rank': ['순위', '랭킹'],
    'best': ['우수', '최고'],
    'worst': ['불량', '최악'],
    'stats': ['통계', '지표'],
    'summary': ['요약', '개요'],
    'optimizer': ['최적화기', '최적엔진'],
    'optimize': ['최적화', '자동계산'],
    'coordination': ['연동', '싱크'],
    'status': ['상태', '현황'],
    'master': ['마스터', '주교차로'],
    'slave': ['슬레이브', '종속교차로'],
    'loss': ['손실', '로스'],
    'menu': ['메뉴', '탭', '화면'],
    'home': ['홈', '메인'],
    'intersection': ['교차로'],
    'tsd': ['시공도', 'TSD'],
    'manual': ['매뉴얼', '설명서'],
    'search': ['검색', '찾기'],
    'input': ['입력창', '입력'],
    'result': ['결과', '리스트'],
    'filter': ['필터', '조건'],
    'modal': ['창', '팝업'],
    'close': ['닫기', '엑스'],
    'save': ['저장', '적용'],
    'alert': ['알림', '경고'],
    'error': ['오류', '에러'],
    'success': ['성공', '완료'],
    'warning': ['주의'],
    'loading': ['로딩', '기다림'],
    'spinner': ['스피너'],
    'time': ['시간', '타임'],
    'date': ['날짜', '일자'],
    'memory': ['메모리', '용량'],
    'storage': ['저장소', '공간'],
    'clear': ['초기화', '지우기', '비우기'],
    'color': ['색상', '컬러'],
    'palette': ['팔레트', '색상표'],
    'font': ['글꼴', '폰트'],
    'family': ['종류'],
    'shadow': ['그림자', '쉐도우'],
    'border': ['테두리', '선'],
    'radius': ['둥글기', '라운드'],
    'gradient': ['그라데이션', '배경색'],
    'chatbot': ['챗봇', '코파일럿', 'AI'],
    'toggle': ['열기닫기', '토글'],
    'window': ['창'],
    'send': ['전송', '보내기'],
    'response': ['답변', '대답'],
    'intent': ['의도', '분석'],
    'expl': ['탐색기', '리스트'],
    'name': ['이름', '명칭'],
    'del': ['삭제', '지우기'],
    'plans': ['계획', '플랜'],
    'maps': ['맵', '현시'],
    'inter': ['교차로', '노드']
};

let addedCount = 0;

for (let key in dict) {
    let aliases = dict[key];
    let newAliases = new Set(aliases);
    
    // 영문 기반 UI 키워드일 경우 한글 번역 로직 수행
    if (key.startsWith('Btn_') || key.startsWith('UI_') || key.startsWith('Class_') || aliases.some(a => /^[a-zA-Z\-]+$/.test(a))) {
        
        // 영단어 토큰화
        let words = [];
        aliases.forEach(a => {
            words.push(...a.toLowerCase().split(/[^a-z]+/));
        });
        words = [...new Set(words.filter(w => w.length > 1))];
        
        let krTokens = [];
        let krExactCombine = [];
        
        words.forEach(w => {
            if (krMap[w]) {
                krTokens.push(...krMap[w]);
                krExactCombine.push(krMap[w][0]); // 가장 대표되는 한글 단어
            }
        });
        
        // 변환된 한글 단어들을 사전에 추가
        if (krTokens.length > 0) {
            krTokens.forEach(t => newAliases.add(t));
            
            // "export" + "csv" + "btn" -> "내보내기CSV파일버튼" 같은 조합어 생성
            if (krExactCombine.length > 1) {
                newAliases.add(krExactCombine.join(' '));
                newAliases.add(krExactCombine.join(''));
            }
        }
    }
    
    const beforeLen = aliases.length;
    dict[key] = Array.from(newAliases);
    addedCount += (dict[key].length - beforeLen);
}

fs.writeFileSync(jsonPath, JSON.stringify(dict, null, 4));
console.log('Added ' + addedCount + ' Korean translation aliases to the existing English UI components.');

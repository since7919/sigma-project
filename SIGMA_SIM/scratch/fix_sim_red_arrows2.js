const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/simulation.js', 'utf8');

content = content.replace(
    /\/\/ \[추가\] 대기 중인 적색 신호\(R\)는 편집 모드가 아니면 숨겨서 DOM 렌더링 부하 방지\s*if \(st === 'R' && !editing\) \{\s*cache\.arrow\.style\.display = 'none';\s*\} else \{\s*cache\.arrow\.style\.display = '';\s*\}/g,
    `// [수정] 적색 신호(R)일 때 숨기면 사용자가 고장인지 전적색인지 알 수 없으므로 항상 표출하도록 수정
                cache.arrow.style.display = '';`
);

content = content.replace(
    /\/\/ \[추가\] 대기 중인 적색 신호\(R\)는 편집 모드가 아니면 숨겨서 DOM 렌더링 부하 방지\s*if \(st === 'R' && !isEditing\) \{\s*cache\.arrow\.style\.display = 'none';\s*\} else \{\s*cache\.arrow\.style\.display = '';\s*\}/g,
    `// [수정] 적색 신호(R)일 때 숨기면 사용자가 고장인지 전적색인지 알 수 없으므로 항상 표출하도록 수정
                cache.arrow.style.display = '';`
);

fs.writeFileSync('SIGMA_SIM/js/simulation.js', content, 'utf8');
console.log('Fixed red arrow visibility with regex');

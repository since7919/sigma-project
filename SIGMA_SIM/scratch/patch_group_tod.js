const fs = require('fs');
let html = fs.readFileSync('C:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_SIM/index.html', 'utf8');

// Replace top button
html = html.replace(
    /<button class="btn-sm btn-apply" onclick="applyGroupToMembers\\(\\)"[^>]*>[\\s\\S]*?<\\/button>/,
    '<button class="phase-action-btn phase-btn-cyan" onclick="applyGroupToMembers()">? 선택 그룹에 일괄 적용</button>'
);

// Replace button set in control bar
html = html.replace(
    /<div class="flex-row gap-4">[\\s\\S]*?<\\/div>/,
    \<div class="flex-row gap-4">
                                    <button onclick="loadGroupInfo()" class="phase-action-btn phase-btn-gray">조회</button>
                                    <button id="btn-clear-highlights" onclick="clearHighlightGroupMembers()" class="phase-action-btn phase-btn-red" title="지도 하이라이트 제거">취소</button>
                                    <button onclick="applyGroupToMembers()" class="phase-action-btn phase-btn-green" title="현재 설정을 모든 소속 교차로에 적용">TOD 일괄적용</button>
                                </div>\
);

// Replace copy select and button
html = html.replace(
    /<select id="copy-from-day" class="tsd-select" style="width: 70px;">/,
    '<select id="copy-from-day" class="phase-select" style="width: 75px;">'
);
html = html.replace(
    /<button class="btn-sm" onclick="copyGroupTODDay\\(\\)"[^>]*>가져오기<\\/button>/,
    '<button class="phase-action-btn phase-btn-purple" onclick="copyGroupTODDay()" title="가져오기">?? 가져오기</button>'
);

fs.writeFileSync('C:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_SIM/index.html', html);
console.log('Group TOD HTML updated');

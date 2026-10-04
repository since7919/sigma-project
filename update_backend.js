const fs = require('fs');

let appJs = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

// Update Model version to gemini-1.5-flash to fix potential model not found issues 
// causing the 503/errors if the backend is trying to use a hallucinated model.
appJs = appJs.replace(
    "model: 'gemini-3.8-flash',",
    "model: 'gemini-1.5-flash',"
);

// Add ASCII graph instruction to the prompt
const oldPrompt = `위 데이터를 바탕으로 아래 목차에 따라 철저히 수치 비교 중심의 분석 리포트를 작성하십시오.
1. 📊 통계 요약표 (주요 지표의 수치적 차이 및 증감률 요약)
2. 📈 거시적 운영 특성 비교 (주기 및 연동망 규모의 통계적 차이 분석)`;

const newPrompt = `위 데이터를 바탕으로 아래 목차에 따라 철저히 수치 비교 중심의 분석 리포트를 작성하십시오.
1. 📊 핵심 지표 ASCII 그래프 비교 (총 교차로 수, 평균 신호주기 등 가장 중요한 3~4개 지표를 선정하여 █ 기호를 사용한 텍스트 기반 ASCII 막대 그래프로 시각화하여 제시)
2. 📋 통계 요약표 (전체 지표의 수치적 차이 및 증감률 요약)
3. 📈 거시적 운영 특성 비교 (주기 및 연동망 규모의 통계적 차이 분석)`;

appJs = appJs.replace(oldPrompt, newPrompt);

fs.writeFileSync('SIGMA_API/sigma-backend/app.js', appJs, 'utf8');
console.log("Updated app.js with gemini-1.5-flash and ASCII graph instruction.");

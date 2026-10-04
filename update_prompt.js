const fs = require('fs');
let appJs = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

const oldPromptBlock = `const systemPrompt = \`당신은 세계 최고 수준의 교통공학 및 신호운영 분석 전문가입니다.
사용자가 제공하는 두 지역(또는 시간대)의 신호운영 통계 데이터를 분석하여, '정책적 차이', '차량 소통 및 연동성', '보행자 및 안전', '정책 제언'의 4가지 관점에서 심도 있는 인사이트 리포트를 마크다운 형식으로 작성해주세요.
명확한 근거(제공된 수치)를 바탕으로 추론하며, 불필요한 인사는 생략하고 바로 리포트를 출력합니다.\`;`;

const newPromptBlock = `const systemPrompt = \`당신은 교통 신호운영 통계 분석 시스템입니다.
이 리포트를 읽는 사용자는 신호주기 및 현시를 직접 제어하는 '경찰공무원 및 최고 수준의 교통공학 전문가집단'입니다. 따라서 기초적인 교통공학 개념 설명이나 AI의 주관적이고 감정적인 평가(예: "너무 깁니다", "우려됩니다", "훌륭합니다")는 절대 배제하십시오.

[작성 지침]
1. 완벽하게 건조하고 객관적인 통계 분석(수치 비교, 증감률, 편차 등) 위주로 서술할 것.
2. 판단은 전문가(사용자)가 내리므로, AI는 두 지역 간의 데이터적 특이점과 수치적 차이에서 도출되는 '객관적 시사점'과 '시스템적 정책 제언'만 짧고 명확하게 제시할 것.
3. 불필요한 서론/결론 인삿말을 생략하고 즉시 마크다운 리포트만 출력할 것.\`;`;

const oldUserPrompt = `[비교 대상]
기준군(Base): \${baseName}
비교군(Target): \${targetName}

[데이터 통계]
기준군 데이터: \${JSON.stringify(baseStats, null, 2)}
비교군 데이터: \${JSON.stringify(targetStats, null, 2)}

위 데이터를 기반으로 다음 목차에 맞게 리포트를 작성해 주세요.
1. 📌 총평 (Executive Summary)
2. 🚗 차량 소통 및 연동성 (Mobility)
3. 🚶 보행자 및 안전 (Safety & Pedestrian)
4. 💡 정책 제언 (Actionable Insights)\`;`;

const newUserPrompt = `[비교 대상]
기준군(Base): \${baseName}
비교군(Target): \${targetName}

[통계 데이터]
- 기준군: \${JSON.stringify(baseStats, null, 2)}
- 비교군: \${JSON.stringify(targetStats, null, 2)}

위 데이터를 바탕으로 아래 목차에 따라 철저히 수치 비교 중심의 분석 리포트를 작성하십시오.
1. 📊 통계 요약표 (주요 지표의 수치적 차이 및 증감률 요약)
2. 📈 거시적 운영 특성 비교 (주기 및 연동망 규모의 통계적 차이 분석)
3. 🚦 현시 및 이동류 구조 분석 (보호/비보호, 대각선 횡단 등 운영 방식의 정량적 차이)
4. 💡 운영 시사점 및 정책적 고려사항 (데이터 기반의 객관적 특이점 및 검토 필요 요소 도출)\`;`;

let updated = false;

// We need to use regex or string replace carefully
// Let's replace the whole block by extracting from `const systemPrompt` to `Actionable Insights)\`;`

const routeStart = "const systemPrompt = `";
const routeEnd = "4. 💡 정책 제언 (Actionable Insights)`;";

const startIndex = appJs.indexOf(routeStart);
const endIndex = appJs.indexOf(routeEnd) + routeEnd.length;

if (startIndex !== -1 && endIndex > startIndex) {
    const replacement = newPromptBlock + "\n\n        const userPrompt = `" + newUserPrompt;
    appJs = appJs.slice(0, Math.max(0, startIndex)) + replacement + appJs.slice(endIndex);
    fs.writeFileSync('SIGMA_API/sigma-backend/app.js', appJs, 'utf8');
    console.log('Prompt updated successfully.');
} else {
    console.log('Could not find prompt block boundaries.');
}

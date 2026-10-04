const fs = require('fs');

let js = fs.readFileSync('../js/stats.js', 'utf8');

// 1. Add yeondeungCount definition
js = js.replace(/let activePlansCount = 0;/g, 'let activePlansCount = 0, yeondeungCount = 0;');

// 2. Increment yeondeungCount inside the junctions loop (around line 1046)
// Find the exact place to insert it
const loopStart = `junctions.forEach(j => {
        let hasValidPlan = false;`;
js = js.replace(loopStart, `junctions.forEach(j => {
        if (j.name && j.name.includes("연등")) yeondeungCount++;
        let hasValidPlan = false;`);

// 3. Replace InsightBox
const oldInsightBoxRegex = /html \+= InsightBox\(null, "사용 중인 일계획 수", \`\$\{activePlansCount\.toLocaleString\(\)\}\`, \`\/ \$\{totalPlans\.toLocaleString\(\)\} 개\`, "운영이 스케줄링된 활성 일계획 수", "📅", "#f1c40f"\);/g;

const newInsightBox = `html += InsightBox(null, "연등 교차로 수", \`\${yeondeungCount.toLocaleString()}개소\`, \`(\${pct(yeondeungCount)}%)\`, "교차로에 제어기가 없이 다른 교차로의 제어기와 연결되어 있는 교차로를 의미해", "🔗", "#f1c40f");`;

js = js.replace(oldInsightBoxRegex, newInsightBox);

fs.writeFileSync('../js/stats.js', js);
console.log("Replaced InsightBox successfully.");

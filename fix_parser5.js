const fs = require('fs');

let code = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const targetRegex = /\/\/ \[4\] 스케줄\(schedules\) 매핑: 일계획\(dayPlansFound\) 기준[\s\S]*?\/\/ \[5\] 패턴\(dayPlans\) 매핑/g;

const replacement = `// [4] 스케줄(schedules) 매핑: 일계획(dayPlansFound) 기준 (1~10 지원)
                for (let dK = 1; dK <= 10; dK++) {
                    let daily = dayPlansFound[dK];
                    // 만약 시차맵(6~10)이 엑셀에 없다면 일반맵(1~5)의 스케줄을 하위호환 복사
                    if (!daily && dK > 5) {
                        daily = dayPlansFound[dK - 5];
                    }
                    if (!daily) continue;
                    
                    const dIdx = dK - 1;
                    junction.dayPlanMapIds[dIdx] = (dK > 5 ? dK - 6 : dK - 1);
                    junction.schedules[dIdx] = Array.from({ length: 16 }, (_, sI) => {
                        const s = daily[sI]; if (!s) return { h: -1, m: 0, cycle: 100, idx: sI + 1 };
                        const [h, m] = s.time.split(':').map(Number);
                        return { h: isNaN(h) ? -1 : h, m: isNaN(m) ? 0 : m, cycle: s.cycle, idx: s.tpIdx || (sI + 1) };
                    });
                }

                // [5] 패턴(dayPlans) 매핑`;

if (targetRegex.test(code)) {
    code = code.replace(targetRegex, replacement);
    fs.writeFileSync('SIGMA_SIM/js/data_parser.js', code, 'utf8');
    console.log("data_parser.js Schedule parsing Fixed!");
} else {
    console.log("Regex failed.");
}

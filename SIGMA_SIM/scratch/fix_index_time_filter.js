const fs = require('fs');

let html = fs.readFileSync('../index.html', 'utf8');

const regex = /<select id="stat-time-filter"[\s\S]*?<\/select>/;
const newSelect = `<select id="stat-time-filter" onchange="renderStats()" class="tsd-select" style="width: 100%; height: 32px; background: rgba(0,0,0,0.4); color: #fff; border: 1px solid rgba(255,255,255,0.1);">
                                        <option value="ALL">전체 (24시간)</option>
                                        <option value="DAYTIME">주간 전일 (06~22시)</option>
                                        <option value="T1">오전 첨두 T1 (07~09시)</option>
                                        <option value="T2">낮 첨두 T2 (12~14시)</option>
                                        <option value="T3">오후 첨두 T3 (17~19시)</option>
                                        <option value="NIGHT">심야 (22~06시)</option>
                                    </select>`;

html = html.replace(regex, newSelect);
fs.writeFileSync('../index.html', html);
console.log('Fixed index.html properly');

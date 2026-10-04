const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('../index.html', 'utf8');
const oldOptions = `<option value="ALL">전체 24시간</option>
                                        <option value="AM_PEAK">오전 출근 (07~09시)</option>
                                        <option value="PM_PEAK">오후 퇴근 (17~19시)</option>
                                        <option value="NORMAL">오전/오후 평시 (09~17시)</option>
                                        <option value="NIGHT">야간/심야 (20~06시)</option>`;
const newOptions = `<option value="ALL">전체 (24시간)</option>
                                        <option value="DAYTIME">주간 전일 (06~22시)</option>
                                        <option value="T1">오전 첨두 T1 (07~09시)</option>
                                        <option value="T2">낮 첨두 T2 (12~14시)</option>
                                        <option value="T3">오후 첨두 T3 (17~19시)</option>
                                        <option value="NIGHT">심야 (22~06시)</option>`;
if (html.includes('value="AM_PEAK"')) {
    // try exact match first
    if (html.includes(oldOptions)) {
        html = html.replace(oldOptions, newOptions);
    } else {
        // regex fallback
        html = html.replace(/<option value="ALL">.*?<\/option>[\s\S]*?<option value="NIGHT">.*?<\/option>/, newOptions);
    }
    fs.writeFileSync('../index.html', html);
    console.log('Updated index.html');
}

// 2. Update stats.js
let js = fs.readFileSync('../js/stats.js', 'utf8');
const oldFilters = `    if (timeFilter === 'AM_PEAK') window.STAT_VALID_HOURS = [7, 8];
    else if (timeFilter === 'PM_PEAK') window.STAT_VALID_HOURS = [17, 18];
    else if (timeFilter === 'NORMAL') window.STAT_VALID_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
    else if (timeFilter === 'NIGHT') window.STAT_VALID_HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
    else window.STAT_VALID_HOURS = Array.from({length:24}, (_, i) => i);`;

const newFilters = `    if (timeFilter === 'T1') window.STAT_VALID_HOURS = [7, 8];
    else if (timeFilter === 'T2') window.STAT_VALID_HOURS = [12, 13];
    else if (timeFilter === 'T3') window.STAT_VALID_HOURS = [17, 18];
    else if (timeFilter === 'DAYTIME') window.STAT_VALID_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    else if (timeFilter === 'NIGHT') window.STAT_VALID_HOURS = [22, 23, 0, 1, 2, 3, 4, 5];
    else window.STAT_VALID_HOURS = Array.from({length:24}, (_, i) => i);`;

if (js.includes("timeFilter === 'AM_PEAK'")) {
    js = js.replace(oldFilters, newFilters);
    fs.writeFileSync('../js/stats.js', js);
    console.log('Updated stats.js');
}


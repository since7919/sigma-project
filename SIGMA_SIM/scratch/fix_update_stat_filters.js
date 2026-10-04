const fs = require('fs');
let js = fs.readFileSync('../js/stats.js', 'utf8');

const regex = /function updateStatFilters\(\) \{[\s\S]*?policeSel\.value = polices\.includes\(currentPolice\) \? currentPolice : 'ALL';\s*\}/;

const newFunc = `function updateStatFilters() {
    const officeSel = document.getElementById('stat-office-filter');
    const policeSel = document.getElementById('stat-police-filter');
    if (!officeSel || !policeSel) return;

    const junctions = Object.values(STATE.junctions);
    if (junctions.length === 0) return;

    const offices = [...new Set(junctions.map(j => (j.office || "").trim()).filter(Boolean))].sort();
    const polices = [...new Set(junctions.map(j => (j.police || "").trim()).filter(Boolean))].sort();

    // 갱신 로직: 데이터가 있는데 드롭다운이 아직 비어있다면(ALL만 있다면) 갱신
    if (officeSel.options.length <= 1 && offices.length > 0) {
        const currentOffice = officeSel.value;
        officeSel.innerHTML = '<option value="ALL">전체 관리청</option>';
        offices.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o; opt.innerText = o;
            officeSel.appendChild(opt);
        });
        officeSel.value = offices.includes(currentOffice) ? currentOffice : 'ALL';
    }

    if (policeSel.options.length <= 1 && polices.length > 0) {
        const currentPolice = policeSel.value;
        policeSel.innerHTML = '<option value="ALL">전체 경찰서</option>';
        polices.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.innerText = p;
            policeSel.appendChild(opt);
        });
        policeSel.value = polices.includes(currentPolice) ? currentPolice : 'ALL';
    }
}`;

if (regex.test(js)) {
    js = js.replace(regex, newFunc);
    fs.writeFileSync('../js/stats.js', js);
    console.log("Replaced updateStatFilters in stats.js");
} else {
    console.log("Could not find updateStatFilters");
}

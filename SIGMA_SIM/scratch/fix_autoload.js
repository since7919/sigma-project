const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/auto_load.js', 'utf8');

const oldStr = `        const priority2 = [
            fetchAndProcess(\`/api/sim/data?file=sigma_group.csv\`, 'group', typeof processGroupCSV === 'function' ? (csv) => processGroupCSV(csv, true) : null, '그룹 마스터'),
        ];
        await Promise.all(priority2);

        const priority3 = [`;

const newStr = `        const priority2 = [
            fetchAndProcess(\`/api/sim/data?file=sigma_group.csv\`, 'group', typeof processGroupCSV === 'function' ? (csv) => processGroupCSV(csv, true) : null, '그룹 마스터'),
        ];
        await Promise.all(priority2);

        // [최적화] 교차로 기본 데이터 로드가 끝났으므로, 무거운 통계/경계선 데이터를 기다리지 않고 즉시 목록을 렌더링하여 체감 속도를 높입니다.
        if (typeof renderJunctionList === 'function') {
            renderJunctionList();
        }

        const priority3 = [`;

code = code.replace(oldStr, newStr);

const oldStr2 = `    if (typeof renderJunctionList === 'function') {
        renderJunctionList();
    }`;

code = code.replace(oldStr2, '');

fs.writeFileSync('SIGMA_SIM/js/auto_load.js', code, 'utf8');
console.log("Fixed auto_load.js");

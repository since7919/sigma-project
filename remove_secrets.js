const fs = require('fs');

// 1. Patch app.js
let appJs = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

// Replace the hardcoded UTIC API key
const hardcodedKeyStr = "|| '013f89aa23da0d52fc89902a5e2fe0f78c1af9bb764b02b31c55f259310c6698'";
if (appJs.includes(hardcodedKeyStr)) {
    appJs = appJs.split(hardcodedKeyStr).join('');
    fs.writeFileSync('SIGMA_API/sigma-backend/app.js', appJs, 'utf8');
    console.log('app.js hardcoded key removed.');
} else {
    console.log('app.js key not found.');
}

// 2. Patch data.js
let dataJs = fs.readFileSync('SIGMA_SIM/js/data.js', 'utf8');

// The vulnerable code block:
/*
    if (btoa(password) !== "MTIzNA==") {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }
*/
const vulnRegex = /if\s*\(\s*btoa\s*\(\s*password\s*\)\s*!==\s*"MTIzNA=="\s*\)\s*\{\s*alert\([^)]+\);\s*return;\s*\}/;

if (dataJs.match(vulnRegex)) {
    dataJs = dataJs.replace(vulnRegex, '// 프론트엔드 비밀번호 검증 제거 (백엔드에서 안전하게 검증됨)');
    fs.writeFileSync('SIGMA_SIM/js/data.js', dataJs, 'utf8');
    console.log('data.js hardcoded password removed.');
} else {
    console.log('data.js password not found.');
}

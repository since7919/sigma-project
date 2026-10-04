const fs = require('fs');

const path = '../js/data.js';
let js = fs.readFileSync(path, 'utf8');

const exportRegex = /function exportNormalizedDBFiles\(\) \{\s*if \(Object\.keys\(STATE\.junctions\)\.length === 0\) \{ alert\(".*?"\); return; \}/;
const saveRegex = /function saveDBFile\(type\) \{\s*if \(Object\.keys\(STATE\.junctions\)\.length === 0\) \{ alert\(".*?"\); return; \}/;

const pwdLogic = `
    const pwd = prompt("다운로드를 위한 비밀번호를 입력하세요.");
    if (!pwd || btoa(pwd) !== "MTIzNA==") {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }`;

let replacedExport = false;
let replacedSave = false;

js = js.replace(exportRegex, (match) => {
    replacedExport = true;
    return match + pwdLogic;
});

js = js.replace(saveRegex, (match) => {
    replacedSave = true;
    return match + pwdLogic;
});

if (replacedExport && replacedSave) {
    fs.writeFileSync(path, js);
    console.log("Success! Updated both functions in data.js");
} else {
    console.log("Error: Could not find regex matches. replacedExport=", replacedExport, "replacedSave=", replacedSave);
}

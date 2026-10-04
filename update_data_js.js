const fs = require('fs');

let dataJs = fs.readFileSync('SIGMA_SIM/js/data.js', 'utf8');

const targetStr = '<strong style="color: #fff; font-size: 16px;">${baseName}</strong>와(과) <strong style="color: #fff; font-size: 16px;">${targetName}</strong>의 통계를 비교분석 중입니다...<br/>';
const replaceStr = '<strong style="color: #fff; font-size: 16px;">${baseName}</strong>와(과) <strong style="color: #fff; font-size: 16px;">${targetName}</strong>의 통계를 비교분석 중입니다...<br/><div style="margin-top: 12px;"><span style="background: rgba(156, 39, 176, 0.2); border: 1px solid #9c27b0; color: #e1bee7; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold;">⚡ Gemini 1.5 Flash (무료 API) 작동 중</span></div>';

dataJs = dataJs.replace(targetStr, replaceStr);

fs.writeFileSync('SIGMA_SIM/js/data.js', dataJs, 'utf8');
console.log("Updated data.js with Gemini version badge.");

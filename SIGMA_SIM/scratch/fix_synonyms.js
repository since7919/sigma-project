const fs = require('fs');
let js = fs.readFileSync('../js/data_parser.js', 'utf8');

js = js.replace('police: getColIdx(["Police", "경찰서"])', 'police: getColIdx(["Police", "경찰서", "경찰서명", "관할경찰서"])');
js = js.replace('office: getColIdx(["Office", "관리청"])', 'office: getColIdx(["Office", "관리청", "구청", "관할구청", "자치구"])');

fs.writeFileSync('../js/data_parser.js', js);
console.log("Updated data_parser.js synonyms");

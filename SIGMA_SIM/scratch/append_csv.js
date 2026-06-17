const fs = require('fs');
const line = '\n"1001","신광4거리","37.4643680","126.6360530","0","인천","인천","","0|||","0|","","","-1","1;1;1;1;1;2;3"\n';
fs.appendFileSync('db_intersections.csv', line, 'utf8');

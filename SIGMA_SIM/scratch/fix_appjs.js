const fs = require('fs');

const path = '../../SIGMA_API/sigma-backend/app.js';
let js = fs.readFileSync(path, 'utf8');

const regex = /const line = \[r\.id, r\.region_cd, r\.name, r\.lat, r\.lng, r\.seq, r\.police_station, r\.police_office, r\.group_id, r\.flash_config, r\.op_intervention, r\.arrow_configs, r\.controller_type, r\.diagram_order, r\.weekly_plan, r\.api_int_no\]\.map/g;
const newCode = `const line = [r.id, r.region_cd, r.name, r.lat, r.lng, r.seq, r.police, r.office, r.group_id, r.flash_config, r.op_intervention, r.arrow_configs, r.controller_type, r.diagram_order, r.weekly_plan, r.api_int_no].map`;

if (js.match(regex)) {
    js = js.replace(regex, newCode);
    fs.writeFileSync(path, js);
    console.log("Fixed app.js police and office columns");
} else {
    console.log("Could not find line in app.js");
}

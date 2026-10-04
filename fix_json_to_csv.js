const fs = require('fs');
let c = fs.readFileSync('SIGMA_API/sigma-backend/app.js', 'utf8');

const regex = /const line = \[r\.id, r\.region_cd, r\.name, r\.lat, r\.lng, r\.seq, r\.police, r\.office, r\.group_id, r\.flash_config, r\.op_intervention, r\.arrow_configs, r\.controller_type, r\.diagram_order, r\.weekly_plan, r\.api_int_no\]\.map\(v => \{ let s = String\(v \?\? ""\);/;

const replaceStr = `
                // JSON to CSV string for arrow_configs
                let arrowStr = "";
                if (r.arrow_configs && typeof r.arrow_configs === 'object') {
                    const arrs = [];
                    Object.entries(r.arrow_configs).forEach(([m, val]) => {
                        if (m === '_custom_angles' && typeof val === 'object') {
                            Object.entries(val).forEach(([pfx, angle]) => {
                                arrs.push(\`_custom_angles:\${pfx}:\${angle}\`);
                            });
                        } else if (Array.isArray(val)) {
                            val.forEach(c => arrs.push(\`\${m}:\${c.dLat}:\${c.dLng}:\${c.rot}\`));
                        }
                    });
                    arrowStr = arrs.join(';');
                } else if (typeof r.arrow_configs === 'string') {
                    arrowStr = r.arrow_configs;
                }
                const line = [r.id, r.region_cd, r.name, r.lat, r.lng, r.seq, r.police, r.office, r.group_id, r.flash_config, r.op_intervention, arrowStr, r.controller_type, r.diagram_order, r.weekly_plan, r.api_int_no].map(v => { let s = String(v ?? "");`;

if(c.includes('const line = [r.id, r.region_cd, r.name, r.lat, r.lng, r.seq, r.police, r.office, r.group_id, r.flash_config, r.op_intervention, r.arrow_configs, r.controller_type, r.diagram_order, r.weekly_plan, r.api_int_no].map(v => { let s = String(v ?? "");')) {
    c = c.replace('const line = [r.id, r.region_cd, r.name, r.lat, r.lng, r.seq, r.police, r.office, r.group_id, r.flash_config, r.op_intervention, r.arrow_configs, r.controller_type, r.diagram_order, r.weekly_plan, r.api_int_no].map(v => { let s = String(v ?? "");', replaceStr.trim());
    fs.writeFileSync('SIGMA_API/sigma-backend/app.js', c, 'utf8');
    console.log("app.js backend serialization fixed.");
} else {
    console.log("Could not find exact match. Will try regex.");
    const m = c.match(regex);
    if(m) {
        c = c.replace(m[0], replaceStr.trim());
        fs.writeFileSync('SIGMA_API/sigma-backend/app.js', c, 'utf8');
        console.log("app.js backend serialization fixed with regex.");
    } else {
        console.log("Regex also failed.");
    }
}

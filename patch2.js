const fs = require('fs');
let f = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');
const search = '<button class="btn-sm" onclick="copyJunctionTODDay()"';
const replace = `<button class="btn-sm" onclick="document.getElementById('xlsx-file-input').click()" style="background:#16a085; padding: 2px 8px; font-size: 9.5px; height: 20px; line-height: 16px; border-radius: 3px; border: 1px solid #1abc9c; color: #fff;">¿¢¼¿ ·Îµå</button>\n                                <button class="btn-sm" onclick="copyJunctionTODDay()"`;
f = f.replace(search, replace);
fs.writeFileSync('SIGMA_SIM/index.html', f);

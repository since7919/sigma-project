const fs = require('fs');

function fix(filepath) {
    let js = fs.readFileSync(filepath, 'utf8');
    
    js = js.replace(/101:\s*\['PED-NWSE'\],\s*103:\s*\['PED-NESW'\],?/g, '');
    js = js.replace(/112:\s*\['PED-NW'\],\s*113:\s*\['PED-SW'\],\s*114:\s*\['PED-NE'\],\s*116:\s*\['PED-SE'\],?/g, '');
    js = js.replace(/118:\s*\['PED-NWSE',\s*'PED-NESW'\]\s*(\/\/\s*Full Scramble)?/g, '');
    
    fs.writeFileSync(filepath, js);
    console.log('Fixed ' + filepath);
}

fix('../js/phase_diagram_interactive.js');
fix('../js/stats.js');

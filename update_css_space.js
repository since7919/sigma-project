const fs = require('fs');
let css = fs.readFileSync('SIGMA_SIM/css/layout.css', 'utf8');

css = css.replace(/\.tsd-status-badge \{[^}]+\}/, '.tsd-status-badge { font-size: 10px; font-weight: 600; color: #e3f2fd; background: #131b26; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(100, 181, 246, 0.2); box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; overflow-x: auto; scrollbar-width: none; }');
css = css.replace(/\.tsd-control-bar \{[^}]+\}/, '.tsd-control-bar { display:flex; justify-content:space-between; align-items:center; gap:8px; width:100%; background:#11151c; padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); box-shadow:0 4px 12px rgba(0,0,0,0.2); }');
// Make sure .tsd-header-bar flex-wrap is not wrapping poorly
// In index.html, there's `<div class="flex-row justify-between align-center mb-10 tsd-header-bar">`
// Let's add tsd-header-bar to css
css += '\n.tsd-header-bar { display:flex; justify-content:space-between; align-items:center; flex-wrap:nowrap; gap:12px; overflow:hidden; }';
css += '\n.tsd-btn { padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }';
css += '\n.tsd-btn-danger { background: rgba(255, 82, 82, 0.1); color: #ff5252; border: 1px solid rgba(255, 82, 82, 0.3); }';
css += '\n.tsd-btn-danger:hover { background: rgba(255, 82, 82, 0.2); }';
css += '\n.tsd-btn-success { background: rgba(0, 230, 118, 0.1); color: #00e676; border: 1px solid rgba(0, 230, 118, 0.3); }';
css += '\n.tsd-btn-success:hover { background: rgba(0, 230, 118, 0.2); }';

fs.writeFileSync('SIGMA_SIM/css/layout.css', css, 'utf8');
console.log("css updated");

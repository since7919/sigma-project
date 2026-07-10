const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, 'src', 'App.jsx');
let content = fs.readFileSync(appPath, 'utf8');

// 1. Remove imports
content = content.replace(/import MapSignalOverlay from '.\/components\/MapSignalOverlay';\r?\n/, '');
content = content.replace(/import MultiSignalCard from '.\/components\/MultiSignalCard';\r?\n/, '');
content = content.replace(/import HeaderClock from '.\/components\/HeaderClock';\r?\n/, '');

// 2. Remove states from line 56 to 167 (approx, we will use regex)
content = content.replace(/  const \[activeMapSignalIds[\s\S]*?handleDropOnSlot[\s\S]*?\};/m, '');

// 3. Remove ping logic for multiScreenItems
content = content.replace(/    multiScreenItems\.forEach\(item => \{\r?\n      if \(item\) \{\r?\n        activeIds\.push\(String\(item\.int_no\)\);\r?\n      \}\r?\n    \}\);\r?\n/m, '');

// 4. Remove handleMultiClick
content = content.replace(/  const handleMultiClick = \(intersection\) => \{[\s\S]*?  \};\r?\n\r?\n/m, '');

// 5. Remove handleMapSignalToggle
content = content.replace(/  const handleMapSignalToggle = \(id\) => \{[\s\S]*?  \};\r?\n\r?\n/m, '');

// 6. Remove map-control-overlay block
content = content.replace(/          \{\/\* 지도상 신호 표출 모드 선택기 \*\/\}[\s\S]*?          <\/div>\r?\n\r?\n/m, '');

// 7. Remove props from IntersectionMarkers
content = content.replace(/              onMultiClick=\{handleMultiClick\}\r?\n/m, '');
content = content.replace(/              activeMapSignalIds=\{activeMapSignalIds\}\r?\n/m, '');
content = content.replace(/              onMapSignalToggle=\{handleMapSignalToggle\}\r?\n/m, '');
content = content.replace(/              showMapNames=\{showMapNames\}\r?\n/m, '');

// 8. Remove MapSignalOverlay from MapContainer
content = content.replace(/            \{\/\* 지도상 신호 표출 레이어 \*\/\}[\s\S]*?              \}\)\}\r?\n/m, '');

// 9. Remove multi-screen-panel
content = content.replace(/      \{\/\* 우측 멀티디스플레이 패널 \*\/\}[\s\S]*?      <\/section>\r?\n\r?\n/m, '');

// 10. Remove isMultiScreenOpen prop from SingleDetailOverlay
content = content.replace(/          isMultiScreenOpen=\{isMultiScreenOpen\}\r?\n/m, '');

// SidebarAccordion props
content = content.replace(/          activeMapSignalIds=\{activeMapSignalIds\}\r?\n/m, '');
content = content.replace(/          onMapSignalToggle=\{handleMapSignalToggle\}\r?\n/m, '');

fs.writeFileSync(appPath, content);
console.log('App.jsx cleaned');

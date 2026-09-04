const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/components/SidebarAccordion.jsx', 'utf8');

const rtiGroup = `
        {/* 3. 행정안전부 전국 실시간 신호 (RTI) */}
        <div className="acc-group">
          <div className="acc-header" onClick={() => {
            const nextOpen = !rtiOpen;
            setRtiOpen(nextOpen);
            if (nextOpen) {
              setTdataOpen(false);
              setUticOpen(false);
              setActiveTab('rti');
            } else {
              if (activeTab === 'rti') setActiveTab(null);
            }
          }} style={{ position: 'relative' }}>
            <span className="acc-icon">{rtiOpen ? '▼' : '▶'}</span>
            🚦 행정안전부 실시간 신호 (RTI)
          </div>
          {rtiOpen && (
            <div className="acc-body">
              <div style={{ padding: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>
                행정안전부 전국지자체 실시간 신호정보 API 연동 준비 중입니다.<br/>
                (API 엔드포인트 및 파라미터 구성 후 리스트 표출 예정)
              </div>
            </div>
          )}
        </div>
`;

content = content.replace(/<\/div>\s*<\/div>\s*<\/>\s*\);\s*}\s*$/, '</div>\n' + rtiGroup + '\n      </div>\n    </>\n  );\n}');

fs.writeFileSync('../sigma-frontend/src/components/SidebarAccordion.jsx', content, 'utf8');
console.log('patched SidebarAccordion.jsx again');

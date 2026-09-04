const fs = require('fs');
let content = fs.readFileSync('../sigma-frontend/src/components/SidebarAccordion.jsx', 'utf8');

content = content.replace(
  'export default function SidebarAccordion({ intersections, onNodeClick',
  'export default function SidebarAccordion({ rtiIntersections, setRtiIntersections, intersections, onNodeClick'
);

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
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                const code = window.prompt('RTI 교차로 정보를 불러올 법정동코드 10자리를 입력하세요\\n(예: 서울 1100000000, 의왕 4143000000, 대구 2700000000)', '4143000000');
                if (!code) return;
                try {
                  const res = await axios.get(\`\${API_BASE}/api/rti/intersections?stdgCd=\${code}\`);
                  if (res.data.success) {
                    setRtiIntersections(res.data.data);
                    alert(\`교차로 \${res.data.count}건을 성공적으로 불러왔습니다!\`);
                  }
                } catch (err) {
                  alert('RTI 데이터 호출 실패: ' + (err.response?.data?.error || err.message));
                }
              }} 
              style={{ position: 'absolute', right: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }}
              title="RTI 목록 불러오기"
            >
              🔄 데이터 호출
            </button>
          </div>
          {rtiOpen && (
            <div className="acc-body">
              {(!rtiIntersections || rtiIntersections.length === 0) ? (
                <div style={{ padding: '10px', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                  '데이터 호출' 버튼을 눌러<br/>원하는 지역의 실시간 교차로를 불러오세요.
                </div>
              ) : (
                <div className="acc-sub-body">
                  {rtiIntersections.map(item => (
                    <div 
                      key={item.crsrdId} 
                      className={\`tree-item \${activeNodeId === item.crsrdId ? 'selected' : ''}\`}
                      onClick={() => onNodeClick(item.crsrdId)}
                    >
                      <div className="status-dot" style={{background: activeNodeId === item.crsrdId ? '#38bdf8' : (window.RTI_SPAT_MAP && window.RTI_SPAT_MAP[item.crsrdId] ? '#10b981' : '#64748b')}}></div>
                      <span className="id-label">[{item.crsrdId}]</span>
                      <span className="name-label" style={{flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}>{item.crsrdNm}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
`;

content = content.replace(/\{\/\* 3\. 행정안전부 전국 실시간 신호 \(RTI\) \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, rtiGroup);

fs.writeFileSync('../sigma-frontend/src/components/SidebarAccordion.jsx', content, 'utf8');
console.log('patched SidebarAccordion.jsx UI');

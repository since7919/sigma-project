const fs = require('fs');
let appJsx = fs.readFileSync('../sigma-frontend/src/App.jsx', 'utf8');

if (!appJsx.includes('const [rtiIntersections, setRtiIntersections] = useState([])')) {
    appJsx = appJsx.replace(
        'const [intersections, setIntersections] = useState([]);',
        'const [intersections, setIntersections] = useState([]);\n  const [rtiIntersections, setRtiIntersections] = useState([]);'
    );
    
    // Pass to SidebarAccordion
    appJsx = appJsx.replace(
        '<SidebarAccordion \n          intersections={filteredIntersections}',
        '<SidebarAccordion \n          rtiIntersections={rtiIntersections}\n          setRtiIntersections={setRtiIntersections}\n          intersections={filteredIntersections}'
    );
    
    // Add fetching RTI signals logic
    const rtiPollLogic = `
  // RTI 실시간 신호 폴링
  useEffect(() => {
    let interval;
    if (activeTab === 'rti' && rtiIntersections.length > 0) {
      const stdgCd = rtiIntersections[0].stdgCd; // 첫번째 교차로의 코드 기준
      
      const fetchRti = async () => {
        try {
          const start = performance.now();
          const res = await axios.get(\`\${API_BASE}/api/rti/signals?stdgCd=\${stdgCd}\`);
          if (res.data.success) {
            if (!window.RTI_SPAT_MAP) window.RTI_SPAT_MAP = {};
            res.data.data.forEach(item => {
              window.RTI_SPAT_MAP[item.crsrdId] = item;
            });
            window.RTI_SPAT_LAST_UPDATE = new Date();
            setUticUpdateTick(t => t + 1); // Trigger re-render
            const elapsed = Math.round(performance.now() - start);
            setApiStatus(prev => ({...prev, utic: { status: 'RTI On', time: \`\${elapsed}ms\`, color: '#00ffa2' }}));
          }
        } catch (e) {
          console.error('RTI Poll Error', e);
          setApiStatus(prev => ({...prev, utic: { status: 'RTI Error', time: '-ms', color: '#ef4444' }}));
        }
      };
      
      fetchRti();
      interval = setInterval(fetchRti, 2000); // 2초마다 갱신
    }
    return () => clearInterval(interval);
  }, [activeTab, rtiIntersections]);
`;
    
    appJsx = appJsx.replace('  // UTIC 실시간 신호 데이터 폴링', rtiPollLogic + '\n  // UTIC 실시간 신호 데이터 폴링');
    
    fs.writeFileSync('../sigma-frontend/src/App.jsx', appJsx, 'utf8');
    console.log('patched App.jsx');
}

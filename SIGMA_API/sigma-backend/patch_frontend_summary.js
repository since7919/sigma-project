const fs = require('fs');
let appJsx = fs.readFileSync('../sigma-frontend/src/App.jsx', 'utf8');

const fetchSummaryCode = `
  const [safetyZoneSummary, setSafetyZoneSummary] = useState({});

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await axios.get(\`\${API_BASE}/api/safetyzone/summary\`);
        if (res.data.success) {
          setSafetyZoneSummary(res.data.data);
        }
      } catch (e) {
        console.error('Failed to fetch safety zone summary:', e);
      }
    };
    fetchSummary();
  }, []);
  
  // fetch UTIC Intersections
`;

appJsx = appJsx.replace('  // fetch UTIC Intersections', fetchSummaryCode);

appJsx = appJsx.replace(
    '<SidebarAccordion',
    '<SidebarAccordion safetyZoneSummary={safetyZoneSummary}'
);

fs.writeFileSync('../sigma-frontend/src/App.jsx', appJsx, 'utf8');

let sidebarJsx = fs.readFileSync('../sigma-frontend/src/components/SidebarAccordion.jsx', 'utf8');

sidebarJsx = sidebarJsx.replace(
    'export default function SidebarAccordion({ ',
    'export default function SidebarAccordion({ safetyZoneSummary, '
);

const oldHeader = `                    {region} <span className="acc-count">({list.length})</span>`;
const newHeader = `                    {region} <span className="acc-count">({list.length})</span>
                    {safetyZoneSummary && safetyZoneSummary[region.substring(0,3)] && (
                      <span title="어린이 보호구역 데이터 보유 지역" style={{ marginLeft: '6px', fontSize: '13px' }}>🟡</span>
                    )}`;

sidebarJsx = sidebarJsx.replace(oldHeader, newHeader);

fs.writeFileSync('../sigma-frontend/src/components/SidebarAccordion.jsx', sidebarJsx, 'utf8');
console.log('patched frontend for summary');

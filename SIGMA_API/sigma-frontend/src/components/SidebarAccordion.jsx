import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const REGION_MAP = {
  'L01': '서울시', 'L02': '인천시', 'L03': '부천시', 'L04': '광명시',
  'L05': '안양시', 'L06': '과천시', 'L07': '안산시', 'L08': '용인시',
  'L09': '성남시', 'L10': '고양시', 'L11': '시흥시', 'L12': '파주시',
  'L13': '양주시', 'L14': '의정부시', 'L15': '김포시', 'L16': '의왕시',
  'L17': '군포시', 'L18': '남양주시', 'L19': '수원시', 'L20': '광주시',
  'L21': '구리시', 'L22': '하남시', 'L23': '부산시', 'L24': '양산시',
  'L25': '창원시', 'L26': '김해시', 'L28': '거제시', 'L29': '대구시',
  'L30': '대전시', 'L31': '광주광역시', 'L37': '포항시'
};

export default function SidebarAccordion({ intersections, onNodeClick, activeNodeId, onRefresh, uticUpdateTick, activeTab, setActiveTab, seoulActiveIds, activeMapSignalIds, onMapSignalToggle, uticOpenRegions, setUticOpenRegions, filterSeoulActive, setFilterSeoulActive, mainPhases }) {
  const [localSearchKeyword, setLocalSearchKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKeyword(localSearchKeyword);
    }, 250);
    return () => clearTimeout(handler);
  }, [localSearchKeyword]);

  const forceRefreshUtic = async (e) => {
    e.stopPropagation();
    const rCode = window.prompt('DB에 동기화할 지역 코드를 입력하세요 (예: L01, L02, L19...)\n* 입력한 지역의 교차로가 다운로드되어 트리에 표시됩니다.', 'L02');
    if (!rCode) return;
    
    try {
      const res = await axios.get(`${API_BASE}/api/intersections/sync?regionCode=${rCode.toUpperCase()}`);
      if (res.data.success) {
        alert(`[${rCode.toUpperCase()}] 지역 교차로 목록 갱신이 완료되었습니다. (${res.data.count}건)`);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      alert('동기화 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 데이터 그룹화 로직 (useMemo 활용)
  const { tdataList, uticGroups } = useMemo(() => {
    const tdata = [];
    const utic = {};

    // Initialize all 31 regions to guarantee they appear in the tree
    Object.entries(REGION_MAP).forEach(([rCode, rName]) => {
      utic[`${rCode} ${rName}`] = [];
    });

    const lowerKeyword = (debouncedKeyword || '').toLowerCase();

    intersections.forEach(item => {
      if (lowerKeyword) {
        const intNm = (item.int_nm || '').toLowerCase();
        const intNo = String(item.int_no || '').toLowerCase();
        if (!intNm.includes(lowerKeyword) && !intNo.includes(lowerKeyword)) {
          return; // 검색어에 맞지 않으면 제외
        }
      }

      // origin_type 판별 (가정: '서울tdata', 'tdata' 또는 'UTIC', 'utic')
      const isTdata = item.origin_type?.toLowerCase().includes('tdata');
      if (isTdata) {
        tdata.push(item);
      } else {
        const rCode = item.region_cd || '기타';
        const rName = REGION_MAP[rCode] || '';
        const groupKey = rName ? `${rCode} ${rName}` : rCode;
        if (!utic[groupKey]) utic[groupKey] = [];
        utic[groupKey].push(item);
      }
    });

    tdata.sort((a, b) => parseInt(a.int_no || 0, 10) - parseInt(b.int_no || 0, 10));

    return { tdataList: tdata, uticGroups: utic };
  }, [intersections, debouncedKeyword]);

  // 아코디언 상태 관리
  const [tdataOpen, setTdataOpen] = useState(false);
  const [uticOpen, setUticOpen] = useState(false);
  const [tdataLimit, setTdataLimit] = useState(100);

  const toggleRegion = (reg) => {
    setUticOpenRegions(prev => ({...prev, [reg]: !prev[reg]}));
  };

  return (
    <>
      <div className="search-box">
        <input 
          type="text" 
          placeholder="교차로명 검색..." 
          value={localSearchKeyword}
          onChange={(e) => setLocalSearchKeyword(e.target.value)}
        />
        {localSearchKeyword ? (
          <button onClick={() => setLocalSearchKeyword('')} title="검색어 지우기" style={{ color: '#ef4444' }}>✖</button>
        ) : (
          <button style={{ cursor: 'default', opacity: 0.5 }}>🔍</button>
        )}
      </div>
      <div className="accordion-wrapper custom-scroll">
      
        {/* 1. 서울 Tdata 그룹 */}
        <div className="acc-group">
          <div className="acc-header" onClick={() => {
            const nextOpen = !tdataOpen;
            setTdataOpen(nextOpen);
            if (nextOpen) {
              setUticOpen(false);
              setActiveTab('tdata');
            } else {
              if (activeTab === 'tdata') setActiveTab(null);
            }
          }} style={{ display: 'flex', alignItems: 'center' }}>
            <span className="acc-icon">{tdataOpen ? '▼' : '▶'}</span>
            <span style={{ flex: 1 }}>🏛️ 서울Tdata 개방데이터 <span className="acc-count">({tdataList.length})</span></span>
            {tdataOpen && (
              <div 
                className="filter-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  if (setFilterSeoulActive) setFilterSeoulActive(!filterSeoulActive);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '12px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  marginLeft: '8px'
                }}
              >
                <div style={{
                  padding: '2px 8px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  borderRadius: '10px',
                  background: filterSeoulActive ? '#10b981' : 'transparent',
                  color: filterSeoulActive ? '#fff' : '#64748b'
                }}>Live</div>
                <div style={{
                  padding: '2px 8px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  borderRadius: '10px',
                  background: !filterSeoulActive ? '#38bdf8' : 'transparent',
                  color: !filterSeoulActive ? '#fff' : '#64748b'
                }}>ALL</div>
              </div>
            )}
          </div>
          {tdataOpen && (
            <div className="acc-body">
              {tdataList.slice(0, tdataLimit).map(item => (
                <div 
                  key={item.id} 
                  className={`tree-item ${activeNodeId === item.id ? 'selected' : ''}`}
                  onClick={() => onNodeClick(item.id)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify(item));
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={activeMapSignalIds.includes(item.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onMapSignalToggle(item.id);
                    }}
                    style={{ marginRight: '6px', cursor: 'pointer', accentColor: '#10b981' }}
                    title="지도상 신호 표출 (최대 3개)"
                  />
                  <div className="status-dot" style={{background: activeNodeId === item.id ? '#38bdf8' : (((window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[String(item.int_no)]) || (seoulActiveIds && seoulActiveIds.includes(String(item.int_no)))) ? '#3b82f6' : '#64748b')}}></div>
                  <span className="id-label">[{item.int_no}]</span>
                  <span className="name-label" style={{flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}>{item.int_nm}</span>
                  <span className="phase-label" style={{fontSize: '0.7rem', color: '#f59e0b', marginLeft: 'auto', marginRight: '5px'}}>{mainPhases?.[item.id] || (item.id.startsWith('L02') ? 2 : 1)}현시</span>
                </div>
              ))}
              {tdataList.length > tdataLimit && (
                <div 
                  className="tree-item" 
                  style={{ textAlign: 'center', color: '#3b82f6', cursor: 'pointer', justifyContent: 'center' }}
                  onClick={() => setTdataLimit(l => l + 200)}
                >
                  + 더보기 ({tdataLimit} / {tdataList.length})
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. UTIC 그룹 */}
        <div className="acc-group">
          <div className="acc-header" onClick={() => {
            const nextOpen = !uticOpen;
            setUticOpen(nextOpen);
            if (nextOpen) {
              setTdataOpen(false);
              setActiveTab('utic');
            } else {
              if (activeTab === 'utic') setActiveTab(null);
            }
          }} style={{ position: 'relative' }}>
            <span className="acc-icon">{uticOpen ? '▼' : '▶'}</span>
            🚓 경찰청 UTIC 개방데이터
            <button 
              onClick={forceRefreshUtic} 
              style={{ position: 'absolute', right: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }}
              title="목록 강제 갱신"
            >
              🔄 갱신
            </button>
          </div>
          {uticOpen && (
            <div className="acc-body">
              {Object.entries(uticGroups).map(([region, list]) => (
                <div key={region} className="acc-subgroup">
                  <div className="acc-sub-header" onClick={() => toggleRegion(region)}>
                    <span className="acc-icon">{uticOpenRegions[region] ? '▼' : '▶'}</span>
                    {region} <span className="acc-count">({list.length})</span>
                  </div>
                  {uticOpenRegions[region] && (
                    <div className="acc-sub-body">
                      {list.map(item => (
                        <div 
                          key={item.id} 
                          className={`tree-item ${activeNodeId === item.id ? 'selected' : ''}`}
                          onClick={() => onNodeClick(item.id)}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/json', JSON.stringify(item));
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={activeMapSignalIds.includes(item.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              onMapSignalToggle(item.id);
                            }}
                            style={{ marginRight: '6px', cursor: 'pointer', accentColor: '#10b981' }}
                            title="지도상 신호 표출 (최대 3개)"
                          />
                          <div className="status-dot" style={{background: activeNodeId === item.id ? '#38bdf8' : (window.UTIC_SPAT_MAP && window.UTIC_SPAT_MAP[item.int_no] ? '#3b82f6' : '#64748b')}}></div>
                          <span className="id-label">[{item.int_no}]</span>
                          <span className="name-label" style={{flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}>{item.int_nm}</span>
                          <span className="phase-label" style={{fontSize: '0.7rem', color: '#f59e0b', marginLeft: 'auto', marginRight: '5px'}}>{mainPhases?.[item.id] || (item.id.startsWith('L02') ? 2 : 1)}현시</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </>
  );
}

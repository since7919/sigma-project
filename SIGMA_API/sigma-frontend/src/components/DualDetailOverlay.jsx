import React, { useState } from 'react';
import SingleDetailOverlay from './SingleDetailOverlay';

export default function DualDetailOverlay({ intersections, onClose }) {
  const [dualZoomMode, setDualZoomMode] = useState(false);

  return (
    <div className={`dual-overlay-wrapper ${dualZoomMode ? 'zoom-mode' : ''}`}>
      <header className="dual-overlay-header" style={{flexWrap: 'wrap', gap: '10px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
          <span>⚖️ 듀얼 모니터링 모드</span>
          <div style={{display:'flex', gap:'5px', background:'rgba(0,0,0,0.5)', padding:'4px', borderRadius:'8px'}}>
            <button 
              style={{padding:'4px 10px', borderRadius:'4px', border:'none', cursor:'pointer', fontSize:'1rem', fontWeight:'bold', background: !dualZoomMode ? '#38bdf8' : 'transparent', color: !dualZoomMode ? '#fff' : '#94a3b8'}}
              onClick={() => setDualZoomMode(false)}
              title="좌우 분할 (전체 정보)"
            >◫</button>
            <button 
              style={{padding:'4px 10px', borderRadius:'4px', border:'none', cursor:'pointer', fontSize:'1rem', fontWeight:'bold', background: dualZoomMode ? '#38bdf8' : 'transparent', color: dualZoomMode ? '#fff' : '#94a3b8'}}
              onClick={() => setDualZoomMode(true)}
              title="상하 분할 (맵 확대)"
            >⊟</button>
          </div>
        </div>
        <button onClick={onClose} style={{background:'transparent', color:'#fff', border:'none', fontSize:'1.5rem', cursor:'pointer'}}>×</button>
      </header>
      <div className="dual-overlay-content" style={dualZoomMode ? { flexDirection: 'column' } : {}}>
        <div className="dual-panel" style={dualZoomMode ? { flex: 1, borderRight: 'none', borderBottom: '2px solid rgba(255,255,255,0.1)' } : {}}>
          <SingleDetailOverlay intersection={intersections[0]} onClose={onClose} isDual={true} forceZoom={dualZoomMode} />
        </div>
        <div className="dual-panel" style={dualZoomMode ? { flex: 1 } : {}}>
          {intersections[1] ? (
            <SingleDetailOverlay intersection={intersections[1]} onClose={() => {}} isDual={true} forceZoom={dualZoomMode} />
          ) : (
            <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#94a3b8', fontSize:'1.1rem', flexDirection:'column', gap:'15px'}}>
              <span>맵이나 트리에서 두 번째 교차로의 [듀얼 비교선택 담기]를 클릭하세요.</span>
              <div className="spinner" style={{width:'30px', height:'30px', border:'3px solid #334155', borderTopColor:'#38bdf8', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div>
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

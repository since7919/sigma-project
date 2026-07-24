import React from 'react';
import { calculateArrowSignals, calculateCompassSignals } from '../utils/signalUtils';

const keyToPfxMap = {
  'N': 'nt', 'NE': 'ne', 'E': 'et', 'SE': 'se',
  'S': 'st', 'SW': 'sw', 'W': 'wt', 'NW': 'nw'
};

export default function CompassOverlay({ displayMode, updatedPhases, onAngleChange }) {
  if (displayMode === 'off') return null;
  
  if (displayMode === 'arrow') {
    const arrowStates = calculateArrowSignals({ updatedPhases });

    const htmlContent = arrowStates.map(({ m, isPed, arrowData, topPx, leftPx, textRot, signalState, countdown, colorClass }) => {
      if (signalState === 'off') return null;

      const isPedOnly = isPed;

      const dx = leftPx - 90;
      const dy = topPx - 90;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const outX = (dx / len) * 18;
      const outY = (dy / len) * 18;
      
      const degVal = isPedOnly ? m - 100 : m; // Just a fallback approximation for arrow pfx if needed
      // To support drag in arrow mode properly, we'd need exact pfx mapping.
      // For now, let's keep it simple or map it via defPosAngles in utils.
      // Arrow mode dragging is omitted for simplicity unless requested, but we can add cursor.

      return (
        <div key={`ms-arrow-${m}`} className="signal-slot" style={{ position: 'absolute', top: `${topPx}px`, left: `${leftPx}px`, transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10000, width: '40px', height: '40px' }}>
          <div className={`signal-arrow ${colorClass} ${isPedOnly ? 'walk-mode' : ''}`} style={{ transform: `rotate(${textRot}deg)`, fontWeight: 800, fontSize: isPedOnly ? '11px' : '22px', lineHeight: 1, color: colorClass === 'yellow' ? '#ffeb3b' : '#00ffbb', opacity: signalState === 'F' ? 0.8 : 1, animation: signalState === 'F' ? 'blink 1s infinite' : 'none' }}>
            {isPedOnly ? 'WALK' : arrowData.type}
          </div>
          <div style={{ position: 'absolute', fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold', color: colorClass === 'yellow' ? '#f59e0b' : '#00ffa2', textShadow: '0 0 3px #000, 0 0 5px #000', lineHeight: 1, transform: `translate(${outX}px, ${outY}px)` }}>
            {countdown > 0 ? `${countdown}s` : ''}
          </div>
        </div>
      );
    });

    return (
      <div className="compass-center-overlay-wrapper" style={{ position: 'absolute', top: '50%', left: '50%', width: '180px', height: '180px', pointerEvents: 'none', zIndex: 9999, transform: 'translate(-50%, -50%)', zoom: 'var(--compass-scale-115, 1.15)', transformOrigin: 'center' }}>
        <div className="compass-center-overlay" style={{ background: 'none', border: 'none', boxShadow: 'none' }}>
          {htmlContent}
        </div>
      </div>
    );
  }

  const compassStates = calculateCompassSignals({ updatedPhases });

  const handlePointerDown = (e, pfx) => {
    if (!onAngleChange) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.closest('.compass-center-overlay').getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const onPointerMove = (moveEvent) => {
      const dx = moveEvent.clientX - centerX;
      const dy = moveEvent.clientY - centerY;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      onAngleChange(pfx, Math.round(angle));
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="compass-center-overlay-wrapper" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '180px',
      height: '180px',
      pointerEvents: 'none',
      zIndex: 9999,
      transform: 'translate(-50%, -50%)',
      zoom: 'var(--compass-scale-115, 1.15)',
      transformOrigin: 'center'
    }}>
      <div className="compass-center-overlay">
        {compassStates.map(({ key, deg, customAngle, vehHasData, pedHasData, carCountdown, pedCountdown, crOn, cyOn, caOn, cgOn, prOn, pgOn, carColor, pedColor, dirLabel }) => {
          if (!vehHasData && !pedHasData) return null;
          
          const pfx = keyToPfxMap[key];

          return (
            <div key={key} className={`signal-slot slot-${key}`} id={`slot-${key}`} style={{ transform: `rotate(${customAngle}deg)` }}>
              {vehHasData && (
                <div 
                  className="signal-mount-frame" 
                  id={`veh-block-${key}`} 
                  onPointerDown={(e) => handlePointerDown(e, pfx)}
                  style={{ pointerEvents: onAngleChange ? 'auto' : 'none', cursor: onAngleChange ? 'grab' : 'default' }}
                >
                  <div className="component-block">
                    <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 'bold', marginBottom: '2px', textAlign: 'center', textShadow: '0 0 3px #000', whiteSpace: 'nowrap' }}>
                      {dirLabel} ({customAngle}°) {carCountdown > 0 ? <span style={{color: carColor}}>{carCountdown}s</span> : null}
                    </div>
                    <div className="car-housing-box">
                      <div className={`lens c-red ${crOn ? 'on' : ''}`}></div>
                      <div className={`lens c-yellow ${cyOn ? 'on' : ''}`}></div>
                      <div className={`lens c-arrow ${caOn ? 'on' : ''}`}></div>
                      <div className={`lens c-green ${cgOn ? 'on' : ''}`}></div>
                    </div>
                  </div>
                </div>
              )}
              {pedHasData && (
                <div className="ped-mount-container">
                  <div 
                    className="ped-mount-frame" 
                    id={`ped-block-${key}`}
                    onPointerDown={(e) => handlePointerDown(e, pfx)}
                    style={{ pointerEvents: onAngleChange ? 'auto' : 'none', cursor: onAngleChange ? 'grab' : 'default' }}
                  >
                    <div className="ped-housing-box">
                      <div className={`ped-lens p-red ${prOn ? 'on' : ''}`}></div>
                      <div className={`ped-lens p-green ${pgOn ? 'on' : ''}`}></div>
                    </div>
                    <div className="micro-timer ped-timer" style={{color: pedColor}}>{pedCountdown > 0 ? `${pedCountdown}s` : '-'}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

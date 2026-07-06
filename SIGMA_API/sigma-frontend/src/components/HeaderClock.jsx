import React, { useEffect, useState } from 'react';

export default function HeaderClock() {
  const [utcTimeStr, setUtcTimeStr] = useState('-');
  const [localTimeStr, setLocalTimeStr] = useState('-');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTimeStr(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
      
      const kstTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
      const kstNow = new Date(kstTimeStr);
      setLocalTimeStr(
        kstNow.getFullYear() + '-' + 
        String(kstNow.getMonth() + 1).padStart(2, '0') + '-' + 
        String(kstNow.getDate()).padStart(2, '0') + ' ' + 
        kstNow.toLocaleTimeString('ko-KR', { hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="multi-panel-footer" style={{
      padding: '10px 20px',
      background: 'rgba(0, 0, 0, 0.4)',
      borderTop: '1px solid var(--glass-border)',
      textAlign: 'center',
      fontSize: '0.75rem',
      color: '#94a3b8',
      fontFamily: 'monospace',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '15px'
    }}>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <span>🕒 로컬 표준시 (KST):</span>
        <strong style={{ color: '#10b981' }}>{localTimeStr}</strong>
      </div>
      <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.15)' }}></div>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <span>🌐 시스템 표준시 (UTC):</span>
        <strong style={{ color: '#38bdf8' }}>{utcTimeStr}</strong>
      </div>
    </footer>
  );
}

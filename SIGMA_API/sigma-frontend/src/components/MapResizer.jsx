import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function MapResizer({ mapZoomMode }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300); // 레이아웃 전환 애니메이션 후 실행
    return () => clearTimeout(timer);
  }, [mapZoomMode, map]);
  return null;
}

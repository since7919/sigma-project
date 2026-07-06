import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

export default function MapPanner({ intersections, targetId }) {
  const map = useMap();
  const lastTargetRef = useRef(null);
  
  useEffect(() => {
    if (targetId && targetId !== lastTargetRef.current) {
      const target = intersections.find(i => i.id === targetId);
      if (target && target.y_coord && target.x_coord) {
        const targetZoom = Math.max(map.getZoom(), 16);
        map.flyTo([target.y_coord, target.x_coord], targetZoom, { duration: 1 });
        lastTargetRef.current = targetId;
      }
    }
  }, [targetId, intersections, map]);
  return null;
}

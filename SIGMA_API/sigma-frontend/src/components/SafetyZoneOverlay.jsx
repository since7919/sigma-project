import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function SafetyZoneOverlay({ isVisible }) {
  const map = useMap();
  const [safetyZoneLayer, setSafetyZoneLayer] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAndDraw = async () => {
      try {
        const res = await axios.get($API_BASE/api/safetyzone);
        const data = res.data;
        
        if (!isMounted) return;

        const layerGroup = L.layerGroup();

        (data.items || []).forEach(item => {
          if (!item.geojson) return;
          
          const name = item.trgtFcltNm || '보호구역';
          
          const geoLayer = L.geoJSON(item.geojson, {
            style: { color: '#e74c3c', weight: 2, fillColor: '#f39c12', fillOpacity: 0.2 },
            pointToLayer: function (feature, latlng) {
              const icon = L.divIcon({
                className: 'safety-zone-marker',
                html: '<div style="width:24px; height:24px; background:rgba(255,165,0,0.8); border:2px solid #fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">🚸</div>',
                iconSize: [24, 24], 
                iconAnchor: [12, 12]
              });
              return L.marker(latlng, { icon });
            }
          });
          
          geoLayer.bindTooltip(name, { permanent: true, direction: 'center', className: 'safetyzone-tooltip' });
          layerGroup.addLayer(geoLayer);
        });

        setSafetyZoneLayer(layerGroup);
      } catch (err) {
        console.error('Error loading safety zones:', err);
      }
    };

    fetchAndDraw();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!safetyZoneLayer) return;

    if (isVisible) {
      safetyZoneLayer.addTo(map);
    } else {
      map.removeLayer(safetyZoneLayer);
    }
  }, [isVisible, safetyZoneLayer, map]);

  return null;
}

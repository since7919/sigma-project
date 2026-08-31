import React, { useEffect, useState, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function SafetyZoneOverlay({ isVisible, intersections }) {
  const map = useMap();
  const [safetyZoneLayer, setSafetyZoneLayer] = useState(null);
  const layerRef = useRef(null);
  const [currentRegion, setCurrentRegion] = useState('L01');

  // Detect which region we are looking at
  const updateRegion = () => {
    if (!intersections || intersections.length === 0) return;
    const bounds = map.getBounds();
    let regionCount = {};
    let maxRegion = currentRegion;
    let maxCount = 0;
    
    for (const item of intersections) {
      if (!item.y_coord || !item.x_coord) continue;
      if (bounds.contains([item.y_coord, item.x_coord])) {
        const r = item.region_cd || 'L01';
        regionCount[r] = (regionCount[r] || 0) + 1;
        if (regionCount[r] > maxCount) {
          maxCount = regionCount[r];
          maxRegion = r;
        }
      }
    }
    
    if (maxRegion !== currentRegion) {
      setCurrentRegion(maxRegion);
    }
  };

  useMapEvents({
    moveend: updateRegion,
    zoomend: updateRegion
  });

  useEffect(() => {
    // Initial check
    updateRegion();
  }, [intersections]);

  useEffect(() => {
    let isMounted = true;
    const fetchAndDraw = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/safetyzone?regionCode=${currentRegion}`);
        const data = res.data;
        
        if (!isMounted) return;

        const layerGroup = L.layerGroup();

        (data.items || []).forEach(item => {
          if (!item.geojson) return;
          
          const name = item.trgtFcltNm || "보호구역";
          
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

        if (layerRef.current) {
           map.removeLayer(layerRef.current);
        }
        layerRef.current = layerGroup;
        setSafetyZoneLayer(layerGroup);
      } catch (err) {
        console.error('Error loading safety zones:', err);
      }
    };

    if (isVisible) {
      fetchAndDraw();
    }

    return () => {
      isMounted = false;
    };
  }, [currentRegion, isVisible, map]);

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

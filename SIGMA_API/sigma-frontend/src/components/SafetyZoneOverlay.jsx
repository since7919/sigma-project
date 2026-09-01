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
    updateRegion();
  }, [intersections]);

  useEffect(() => {
    let isMounted = true;
    const fetchAndDraw = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/safetyzone?regionCode=${currentRegion}`);
        const data = res.data;
        
        if (!isMounted) return;

        const features = [];
        (data.items || []).forEach(item => {
          if (!item.geojson) return;
          
          let geometry = item.geojson;
          if (geometry.type === 'Feature') {
             geometry.properties = { ...geometry.properties, name: item.trgtFcltNm || "보호구역" };
             features.push(geometry);
          } else {
             features.push({
                 type: 'Feature',
                 geometry: geometry,
                 properties: { name: item.trgtFcltNm || "보호구역" }
             });
          }
        });

        const featureCollection = {
            type: 'FeatureCollection',
            features: features
        };

        const geoLayer = L.geoJSON(featureCollection, {
            style: { color: '#e74c3c', weight: 2, fillColor: '#f39c12', fillOpacity: 0.2 },
            pointToLayer: function (feature, latlng) {
              return L.circleMarker(latlng, {
                  radius: 8,
                  color: '#e74c3c',
                  weight: 2,
                  fillColor: '#f39c12',
                  fillOpacity: 0.8
              });
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.properties.name) {
                    // permanent를 지정하지 않음으로써 Hover 시에만 표시되도록 최적화
                    layer.bindTooltip(feature.properties.name, { 
                        direction: 'top', 
                        className: 'safetyzone-tooltip' 
                    });
                }
            }
        });

        if (layerRef.current) {
           map.removeLayer(layerRef.current);
        }
        layerRef.current = geoLayer;
        setSafetyZoneLayer(geoLayer);
      } catch (err) {
        console.error('Error loading safety zones:', err);
      }
    };

    if (isVisible) {
      fetchAndDraw();
    } else {
      // isVisible가 false가 되면 레이어 제거 (리렌더링 시 useEffect 클린업 전에 숨길 수 있게)
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
        setSafetyZoneLayer(null);
      }
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

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { calculateArrowSignals, calculateCompassSignals } from '../utils/signalUtils';
import { useSignalPhases } from '../hooks/useSignalPhases';
import { useRealtimeSignal } from '../hooks/useRealtimeSignal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function MapSignalOverlay({ intersection, uticUpdateTick, onMapSignalToggle, displayMode, mainPhases }) {
  const {
    cropData,
    phaseA,
    phaseB,
    remainA,
    remainB,
    sigMapData
  } = useRealtimeSignal({ intersection, mainPhases });

  const isSeoul = useMemo(() => {
    return intersection.origin_type?.toLowerCase().includes('tdata') || false;
  }, [intersection]);

  const updatedPhases = useSignalPhases({ 
    intersection, 
    isSeoul, 
    cropData, 
    phaseA, 
    phaseB, 
    remainA, 
    remainB, 
    uticUpdateTick, 
    sigMapData, 
    customAngles: intersection.custom_angles 
  });

  const markerRef = useRef(null);

  const htmlString = useMemo(() => {
    if (displayMode === 'arrow') {
      const arrowStates = calculateArrowSignals({
        updatedPhases: updatedPhases.unique
      });

      const htmlContent = arrowStates.map(({ m, isPed, arrowData, topPx, leftPx, textRot, signalState, countdown, colorClass }) => {
        if (signalState === 'off') return '';
        const isPedOnly = isPed;
        
        const dx = leftPx - 90;
        const dy = topPx - 90;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const outX = (dx / len) * 18;
        const outY = (dy / len) * 18;

        return `
          <div class="signal-slot" style="position: absolute; top: ${topPx}px; left: ${leftPx}px; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 10000; width: 40px; height: 40px;">
            <div class="signal-arrow ${colorClass} ${isPedOnly ? 'walk-mode' : ''}" style="transform: rotate(${textRot}deg); font-weight: 800; font-size: ${isPedOnly ? '11px' : '22px'}; line-height: 1; color: ${colorClass === 'yellow' ? '#ffeb3b' : '#00ffbb'};">
              ${isPedOnly ? 'WALK' : arrowData.type}
            </div>
            <div style="position: absolute; font-family: monospace; font-size: 12px; font-weight: bold; color: ${colorClass === 'yellow' ? '#f59e0b' : '#00ffa2'}; text-shadow: 0 0 3px #000, 0 0 5px #000; line-height: 1; transform: translate(${outX}px, ${outY}px);">
              ${countdown > 0 ? `${countdown}s` : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="directions-wrapper" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); zoom: var(--compass-scale, 1); width: 180px; height: 180px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5);">
          <div class="center-box" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #333; border: 2px solid #555; border-radius: 4px;"></div>
          ${htmlContent}
        </div>
      `;
    }

    // Compass Mode
    const compassStates = calculateCompassSignals({
        updatedPhases: updatedPhases.unique
    });

    return `
      <div class="compass-center-overlay-wrapper" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); zoom: var(--compass-scale-11, 1.1); transform-origin: center; pointer-events: none; z-index: 9999; width: 180px; height: 180px;">
        <div class="compass-center-overlay">
          ${compassStates.map(({ key, deg, customAngle, vehHasData, pedHasData, carCountdown, pedCountdown, crOn, cyOn, caOn, cgOn, prOn, pgOn, carColor, pedColor, dirLabel }) => {
            if (!vehHasData && !pedHasData) return '';

            return `
              <div class="signal-slot slot-${key}" id="slot-${key}" style="transform: rotate(${customAngle}deg);">
                ${vehHasData ? `
                  <div class="signal-mount-frame" id="veh-block-${key}">
                    <div class="component-block">
                      <div style="font-size: 10px; color: #38bdf8; font-weight: bold; margin-bottom: 2px; text-align: center; text-shadow: 0 0 3px #000; white-space: nowrap;">
                        ${dirLabel} ${carCountdown > 0 ? `<span style="color:${carColor}">${carCountdown}s</span>` : ''}
                      </div>
                      <div class="car-housing-box">
                        <div class="lens c-red ${crOn ? 'on' : ''}"></div>
                        <div class="lens c-yellow ${cyOn ? 'on' : ''}"></div>
                        <div class="lens c-arrow ${caOn ? 'on' : ''}"></div>
                        <div class="lens c-green ${cgOn ? 'on' : ''}"></div>
                      </div>
                    </div>
                  </div>
                ` : ''}
                ${pedHasData ? `
                  <div class="ped-mount-container">
                    <div class="ped-mount-frame" id="ped-block-${key}">
                      <div class="ped-housing-box">
                        <div class="ped-lens p-red ${prOn ? 'on' : ''}"></div>
                        <div class="ped-lens p-green ${pgOn ? 'on' : ''}"></div>
                      </div>
                      <div class="micro-timer ped-timer" style="color: ${pedColor}">${pedCountdown > 0 ? `${pedCountdown}s` : '-'}</div>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }, [intersection, cropData, phaseA, phaseB, remainA, remainB, sigMapData, isSeoul, displayMode, isSeoul ? uticUpdateTick : 0]);

  const map = useMap();
  
  const onToggleRef = useRef(onMapSignalToggle);
  useEffect(() => {
    onToggleRef.current = onMapSignalToggle;
  }, [onMapSignalToggle]);

  useEffect(() => {
    if (!map) return;
    
    const marker = L.marker([intersection.y_coord, intersection.x_coord], {
      icon: L.divIcon({
        className: 'map-realtime-signal-icon',
        html: htmlString || '<div></div>',
        iconSize: [160, 160],
        iconAnchor: [80, 80]
      }),
      zIndexOffset: 500,
      interactive: false
    });

    marker.addTo(map);
    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, intersection.id, intersection.y_coord, intersection.x_coord]);

  useEffect(() => {
    if (markerRef.current) {
      const el = markerRef.current.getElement();
      if (el) {
        el.innerHTML = htmlString;
      }
    }
  }, [htmlString]);

  return null;
}

'use client';

import { useState, useCallback } from 'react';
import { Marker, Popup } from 'react-map-gl/mapbox';
import type { DiscoveredPOI } from '@/lib/geo/pois';

interface POIMarkersProps {
  pois: DiscoveredPOI[];
  visible: boolean;
}

function getIconForType(type: string): React.ReactNode {
  const lower = type.toLowerCase();

  if (lower.includes('cafe') || lower.includes('coffee')) {
    // Coffee cup
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="14" y1="2" x2="14" y2="4" />
      </svg>
    );
  }

  if (lower.includes('viewpoint') || lower.includes('view')) {
    // Eye / binoculars
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  if (lower.includes('beach')) {
    // Wave
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        <path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        <path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      </svg>
    );
  }

  if (lower.includes('temple') || lower.includes('pagoda')) {
    // Temple / pagoda
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L6 8h12L12 2z" />
        <path d="M8 8v4h8V8" />
        <path d="M6 12v4h12v-4" />
        <path d="M4 16v4h16v-4" />
        <line x1="12" y1="2" x2="12" y2="8" />
      </svg>
    );
  }

  if (lower.includes('restaurant') || lower.includes('food')) {
    // Fork and knife
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <path d="M17 2c-2 0-4 3-4 7s2 7 4 7V2z" />
        <line x1="17" y1="16" x2="17" y2="22" />
      </svg>
    );
  }

  // Default: map pin
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function POIMarkers({ pois, visible }: POIMarkersProps) {
  const [selectedPOI, setSelectedPOI] = useState<DiscoveredPOI | null>(null);

  const handleMarkerClick = useCallback((poi: DiscoveredPOI) => {
    setSelectedPOI(poi);
  }, []);

  const handlePopupClose = useCallback(() => {
    setSelectedPOI(null);
  }, []);

  if (!visible) return null;

  return (
    <>
      {pois.map((poi) => (
        <Marker
          key={poi.placeId}
          latitude={poi.lat}
          longitude={poi.lng}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            handleMarkerClick(poi);
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              cursor: 'pointer',
            }}
          >
            {getIconForType(poi.type)}
          </div>
        </Marker>
      ))}

      {selectedPOI && (
        <Popup
          latitude={selectedPOI.lat}
          longitude={selectedPOI.lng}
          anchor="bottom"
          onClose={handlePopupClose}
          closeOnClick={false}
        >
          <div style={{ maxWidth: 200 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {selectedPOI.name}
            </div>
            <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 4 }}>
              {selectedPOI.description}
            </div>
            {selectedPOI.rating != null && (
              <div style={{ fontSize: 12, color: '#d97706' }}>
                {selectedPOI.rating} rating
              </div>
            )}
          </div>
        </Popup>
      )}
    </>
  );
}

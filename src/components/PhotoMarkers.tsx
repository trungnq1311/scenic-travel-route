'use client';

import { useState, useCallback } from 'react';
import { Marker, Popup } from 'react-map-gl/mapbox';
import type { DiscoveredPOI } from '@/lib/geo/pois';

interface PhotoMarkersProps {
  pois: DiscoveredPOI[];
  visible: boolean;
  onPhotoCountChange?: (count: number) => void;
}

export default function PhotoMarkers({ pois, visible, onPhotoCountChange }: PhotoMarkersProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<{ lat: number; lng: number; url: string; caption: string } | null>(null);

  const handleMarkerClick = useCallback((lat: number, lng: number, url: string, caption: string) => {
    setSelectedPhoto({ lat, lng, url, caption });
  }, []);

  const handlePopupClose = useCallback(() => {
    setSelectedPhoto(null);
  }, []);

  if (!visible) return null;

  const photoUrls = [
    'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1528164344705-47542687000d?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=400&h=300&fit=crop',
  ];

  const captions = [
    'Scenic coastal stretch',
    'Mountain viewpoint',
    'Local fishing village',
    'Golden hour moment',
  ];

  const photoMarkers = pois.slice(0, 4).map((poi, i) => ({
    lat: poi.lat + (Math.random() - 0.5) * 0.01,
    lng: poi.lng + (Math.random() - 0.5) * 0.01,
    url: photoUrls[i % photoUrls.length],
    caption: captions[i % captions.length],
    thumbUrl: photoUrls[i % photoUrls.length].replace('w=400', 'w=100').replace('h=300', 'h=75'),
  }));

  if (photoMarkers.length === 0) return null;

  return (
    <>
      {photoMarkers.map((photo, i) => (
        <Marker
          key={`photo-${i}`}
          latitude={photo.lat}
          longitude={photo.lng}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            handleMarkerClick(photo.lat, photo.lng, photo.url, photo.caption);
          }}
        >
          <div
            style={{
              width: 48,
              height: 36,
              borderRadius: 8,
              overflow: 'hidden',
              border: '3px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            }}
          >
            <img
              src={photo.thumbUrl}
              alt={photo.caption}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        </Marker>
      ))}

      {selectedPhoto && (
        <Popup
          latitude={selectedPhoto.lat}
          longitude={selectedPhoto.lng}
          anchor="bottom"
          onClose={handlePopupClose}
          closeOnClick={false}
          offset={[0, -20]}
        >
          <div style={{ maxWidth: 400, overflow: 'hidden' }}>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.caption}
              style={{
                width: '100%',
                height: 200,
                objectFit: 'cover',
              }}
            />
            <div style={{ padding: 12 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: '#3D3832', marginBottom: 4 }}>
                {selectedPhoto.caption}
              </div>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}

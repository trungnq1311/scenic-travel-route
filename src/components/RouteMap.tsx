'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import Map, { Source, Layer, MapRef } from 'react-map-gl/mapbox';
import { LngLatBounds, MapMouseEvent } from 'mapbox-gl';
import type { LayerProps } from 'react-map-gl/mapbox';
import type { ProcessedRoute } from '@/lib/pipeline/types';
import POIMarkers from './POIMarkers';

/** Scenic route colors assigned by index */
const SCENIC_COLORS = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#8b5cf6', // purple
  '#10b981', // green
  '#14b8a6', // teal
];

const BASELINE_COLOR = '#9ca3af';

export interface RouteMapProps {
  routes: ProcessedRoute[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
}

function getLayerId(route: ProcessedRoute): string {
  return `route-layer-${route.id}`;
}

function getSourceId(route: ProcessedRoute): string {
  return `route-${route.id}`;
}

/**
 * Assigns a color to a route. Baseline routes are always gray;
 * scenic routes cycle through the palette by their index among non-baseline routes.
 */
function getRouteColor(route: ProcessedRoute, scenicIndex: number): string {
  if (route.isBaseline) return BASELINE_COLOR;
  return SCENIC_COLORS[scenicIndex % SCENIC_COLORS.length];
}

export default function RouteMap({
  routes,
  selectedRouteId,
  onSelectRoute,
}: RouteMapProps) {
  const mapRef = useRef<MapRef>(null);

  // Build a scenic-index lookup: non-baseline routes get incrementing indices
  const scenicIndexMap = useMemo(() => {
    const lookup: Record<string, number> = {};
    let idx = 0;
    for (const route of routes) {
      if (!route.isBaseline) {
        lookup[route.id] = idx++;
      }
    }
    return lookup;
  }, [routes]);

  // All layer IDs for interactiveLayerIds
  const interactiveLayerIds = useMemo(
    () => routes.map((r) => getLayerId(r)),
    [routes],
  );

  // Find the currently selected route
  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );

  // Fit bounds to all route geometries on first load
  const fitBoundsToRoutes = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || routes.length === 0) return;

    const bounds = new LngLatBounds();
    for (const route of routes) {
      for (const coord of route.geometry.coordinates) {
        bounds.extend(coord as [number, number]);
      }
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
      });
    }
  }, [routes]);

  // Fit bounds when routes change
  useEffect(() => {
    fitBoundsToRoutes();
  }, [fitBoundsToRoutes]);

  const handleClick = useCallback(
    (event: MapMouseEvent) => {
      // When interactiveLayerIds is set, the event has features attached
      const features = (
        event as MapMouseEvent & { features?: { properties?: { routeId?: string } }[] }
      ).features;
      const routeId = features?.[0]?.properties?.routeId;
      if (routeId) {
        onSelectRoute(routeId);
      }
    },
    [onSelectRoute],
  );

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/outdoors-v12"
      style={{ width: '100%', height: '100%' }}
      initialViewState={{
        latitude: 10.8,
        longitude: 106.6,
        zoom: 8,
      }}
      interactiveLayerIds={interactiveLayerIds}
      onClick={handleClick}
      onLoad={fitBoundsToRoutes}
    >
      {routes.map((route) => {
        const isSelected = route.id === selectedRouteId;
        const scenicIdx = scenicIndexMap[route.id] ?? 0;
        const color = getRouteColor(route, scenicIdx);

        const geojsonData = {
          type: 'Feature' as const,
          properties: { routeId: route.id },
          geometry: route.geometry,
        };

        const layerStyle: LayerProps = {
          id: getLayerId(route),
          type: 'line',
          paint: {
            'line-color': color,
            'line-width': isSelected ? 5 : 3,
            'line-opacity': isSelected
              ? 1
              : route.isBaseline
                ? 0.3
                : 0.35,
            ...(route.isBaseline && !isSelected
              ? { 'line-dasharray': [4, 4] }
              : {}),
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        };

        return (
          <Source
            key={route.id}
            id={getSourceId(route)}
            type="geojson"
            data={geojsonData}
          >
            <Layer {...layerStyle} />
          </Source>
        );
      })}

      {/* Scenic glow effect for selected non-baseline route */}
      {routes.map((route) => {
        const isSelected = route.id === selectedRouteId;
        if (!isSelected || route.isBaseline) return null;

        const scenicIdx = scenicIndexMap[route.id] ?? 0;
        const color = getRouteColor(route, scenicIdx);

        const glowLayerStyle: LayerProps = {
          id: `glow-layer-${route.id}`,
          type: 'line',
          paint: {
            'line-color': color,
            'line-width': 12,
            'line-opacity': 0.25,
            'line-blur': 4,
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        };

        return (
          <Source
            key={`glow-${route.id}`}
            id={`glow-${route.id}`}
            type="geojson"
            data={{
              type: 'Feature',
              properties: { routeId: route.id },
              geometry: route.geometry,
            }}
          >
            <Layer {...glowLayerStyle} />
          </Source>
        );
      })}

      {/* POI markers for selected non-baseline route */}
      <POIMarkers
        pois={selectedRoute?.pois ?? []}
        visible={selectedRoute != null && !selectedRoute.isBaseline}
      />
    </Map>
  );
}

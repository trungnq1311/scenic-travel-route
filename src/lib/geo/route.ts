import type { GeocodedWaypoint } from './geocode';
import type { ExtractedRoute } from '../llm/types';

export interface RouteGeometry {
  routeId: string;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  distanceKm: number;
  durationMinutes: number;
  waypoints: { lat: number; lng: number; name: string }[];
}

const MAPBOX_DIRECTIONS_URL =
  'https://api.mapbox.com/directions/v5/mapbox/driving';
const MAX_WAYPOINTS = 25;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT = 3;

/**
 * Subsample an array of waypoints down to MAX_WAYPOINTS, preserving
 * the first and last element with evenly spaced picks in between.
 */
function subsampleWaypoints(
  waypoints: GeocodedWaypoint[],
): GeocodedWaypoint[] {
  if (waypoints.length <= MAX_WAYPOINTS) return waypoints;

  const result: GeocodedWaypoint[] = [waypoints[0]];
  const innerCount = MAX_WAYPOINTS - 2; // slots between first and last
  const step = (waypoints.length - 1) / (innerCount + 1);

  for (let i = 1; i <= innerCount; i++) {
    const index = Math.round(step * i);
    result.push(waypoints[index]);
  }

  result.push(waypoints[waypoints.length - 1]);
  return result;
}

function formatCoordinates(waypoints: GeocodedWaypoint[]): string {
  return waypoints.map((wp) => `${wp.lng},${wp.lat}`).join(';');
}

async function fetchFromMapbox(
  routeId: string,
  waypoints: GeocodedWaypoint[],
): Promise<RouteGeometry | null> {
  const apiKey = process.env.MAPBOX_API_KEY ?? '';
  const sampled = subsampleWaypoints(waypoints);
  const coordinates = formatCoordinates(sampled);
  const url = `${MAPBOX_DIRECTIONS_URL}/${coordinates}?geometries=geojson&overview=full&steps=false&access_token=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route) {
      return null;
    }

    return {
      routeId,
      geometry: route.geometry,
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      waypoints: sampled.map((wp) => ({
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
      })),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchRouteGeometry(
  routeId: string,
  waypoints: GeocodedWaypoint[],
): Promise<RouteGeometry | null> {
  if (waypoints.length < 2) return null;
  return fetchFromMapbox(routeId, waypoints);
}

export async function fetchBaselineRoute(
  origin: GeocodedWaypoint,
  destination: GeocodedWaypoint,
): Promise<RouteGeometry | null> {
  return fetchFromMapbox('baseline', [origin, destination]);
}

/**
 * Fetch route geometries for all extracted routes, always injecting
 * origin as first waypoint and destination as last waypoint to guarantee
 * every route goes from A to B.
 */
export async function fetchAllRouteGeometries(
  routes: ExtractedRoute[],
  geocodedWaypoints: GeocodedWaypoint[],
  origin?: GeocodedWaypoint,
  destination?: GeocodedWaypoint,
): Promise<RouteGeometry[]> {
  const results: RouteGeometry[] = [];

  // Process in chunks of MAX_CONCURRENT
  for (let i = 0; i < routes.length; i += MAX_CONCURRENT) {
    const chunk = routes.slice(i, i + MAX_CONCURRENT);

    const promises = chunk.map((route) => {
      const matched = route.waypoints
        .map((routeWp) => {
          const routeName = routeWp.name.toLowerCase();
          return geocodedWaypoints.find((geoWp) => {
            const geoName = geoWp.name.toLowerCase();
            return geoName.includes(routeName) || routeName.includes(geoName);
          });
        })
        .filter((wp): wp is GeocodedWaypoint => wp != null);

      // Inject origin at the start and destination at the end
      // to guarantee the route spans the full corridor
      const waypoints = buildEndpointWaypoints(matched, origin, destination);

      if (waypoints.length < 2) return Promise.resolve(null);
      return fetchRouteGeometry(route.id, waypoints);
    });

    const chunkResults = await Promise.all(promises);

    for (const result of chunkResults) {
      if (result != null) {
        results.push(result);
      }
    }
  }

  return results;
}

/**
 * Build the final waypoint list for a route, ensuring origin is first
 * and destination is last. Avoids duplicate injection if the first/last
 * matched waypoint is already near the origin/destination.
 */
function buildEndpointWaypoints(
  matched: GeocodedWaypoint[],
  origin?: GeocodedWaypoint,
  destination?: GeocodedWaypoint,
): GeocodedWaypoint[] {
  const NEAR_THRESHOLD_KM = 10;
  const result = [...matched];

  if (origin && result.length > 0) {
    const firstDist = haversineKm(
      result[0].lat, result[0].lng,
      origin.lat, origin.lng,
    );
    if (firstDist > NEAR_THRESHOLD_KM) {
      result.unshift(origin);
    }
  } else if (origin) {
    result.unshift(origin);
  }

  if (destination && result.length > 0) {
    const lastDist = haversineKm(
      result[result.length - 1].lat, result[result.length - 1].lng,
      destination.lat, destination.lng,
    );
    if (lastDist > NEAR_THRESHOLD_KM) {
      result.push(destination);
    }
  } else if (destination) {
    result.push(destination);
  }

  return result;
}

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

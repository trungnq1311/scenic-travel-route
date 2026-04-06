import type { ExtractedWaypoint } from '../llm/types';

export interface GeocodedWaypoint {
  name: string;
  lat: number;
  lng: number;
  source: 'google' | 'mapbox' | 'llm_estimate';
  confidence: 'high' | 'medium' | 'low';
}

// Southern Vietnam bounding box for result validation
const SOUTH_VIETNAM_BBOX = {
  latMin: 8.0,
  latMax: 12.0,
  lngMin: 104.0,
  lngMax: 110.0,
};

const GEOCODE_TIMEOUT_MS = 5_000;
const CHUNK_SIZE = 5;

function isWithinBbox(lat: number, lng: number): boolean {
  return (
    lat >= SOUTH_VIETNAM_BBOX.latMin &&
    lat <= SOUTH_VIETNAM_BBOX.latMax &&
    lng >= SOUTH_VIETNAM_BBOX.lngMin &&
    lng <= SOUTH_VIETNAM_BBOX.lngMax
  );
}

function createTimeoutSignal(): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  return controller.signal;
}

/**
 * Geocode via Google Geocoding API using component filtering.
 * Component filtering avoids the wrong-result problem with raw Vietnamese
 * address strings caused by the 2026 administrative reorganization.
 */
async function tryGoogle(name: string): Promise<GeocodedWaypoint | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const components = `locality:${encodeURIComponent(name)}|country:VN`;
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?components=${components}&region=vn&language=vi&key=${apiKey}`;

  try {
    const res = await fetch(url, { signal: createTimeoutSignal() });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const location = data.results[0].geometry?.location;
    if (!location) return null;

    const { lat, lng } = location;
    if (!isWithinBbox(lat, lng)) return null;

    return { name, lat, lng, source: 'google', confidence: 'high' };
  } catch {
    return null;
  }
}

/**
 * Geocode via Mapbox Geocoding API as fallback.
 * Uses a tighter bbox param to constrain results to the southern Vietnam corridor.
 */
async function tryMapbox(name: string): Promise<GeocodedWaypoint | null> {
  const apiKey = process.env.MAPBOX_API_KEY;
  if (!apiKey) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json` +
    `?bbox=106.0,10.0,108.0,11.5&country=VN&language=vi&access_token=${apiKey}`;

  try {
    const res = await fetch(url, { signal: createTimeoutSignal() });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.features || data.features.length === 0) return null;

    const center = data.features[0].center;
    if (!center || center.length < 2) return null;

    // Mapbox center is [lng, lat]
    const lng = center[0];
    const lat = center[1];

    return { name, lat, lng, source: 'mapbox', confidence: 'medium' };
  } catch {
    return null;
  }
}

/**
 * Geocode a single waypoint using Google (primary) then Mapbox (fallback).
 * If both APIs fail and LLM-estimated coordinates are provided, returns those
 * with low confidence. Throws if nothing works.
 */
export async function geocodeWaypoint(
  name: string,
  llmLat?: number,
  llmLng?: number,
): Promise<GeocodedWaypoint> {
  // 1. Try Google with component filtering
  const googleResult = await tryGoogle(name);
  if (googleResult) return googleResult;

  // 2. Fall back to Mapbox
  const mapboxResult = await tryMapbox(name);
  if (mapboxResult) return mapboxResult;

  // 3. Fall back to LLM estimate
  if (llmLat !== undefined && llmLng !== undefined) {
    return {
      name,
      lat: llmLat,
      lng: llmLng,
      source: 'llm_estimate',
      confidence: 'low',
    };
  }

  throw new Error(`Geocoding failed for "${name}": all sources exhausted`);
}

/**
 * Geocode all waypoints in parallel, processing in chunks of 5 to respect
 * rate limits. Failed geocodes fall back to the LLM-estimated coordinates
 * from the original ExtractedWaypoint.
 */
export async function geocodeAllWaypoints(
  waypoints: ExtractedWaypoint[],
): Promise<GeocodedWaypoint[]> {
  const results: GeocodedWaypoint[] = [];

  for (let i = 0; i < waypoints.length; i += CHUNK_SIZE) {
    const chunk = waypoints.slice(i, i + CHUNK_SIZE);

    const settled = await Promise.allSettled(
      chunk.map((wp) =>
        geocodeWaypoint(wp.name, wp.lat, wp.lng),
      ),
    );

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        // Fallback to LLM estimate from the extracted waypoint
        const wp = chunk[j];
        results.push({
          name: wp.name,
          lat: wp.lat,
          lng: wp.lng,
          source: 'llm_estimate',
          confidence: 'low',
        });
      }
    }
  }

  return results;
}

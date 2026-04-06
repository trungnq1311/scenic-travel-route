import type { RouteGeometry } from './route';
import type { ExtractedPOI } from '../llm/types';

export interface DiscoveredPOI {
  name: string;
  lat: number;
  lng: number;
  type: string;
  description: string;
  rating?: number;
  userRatingsTotal?: number;
  placeId: string;
  sources: string[];
}

/**
 * Approximate distance in km between two lat/lng points using the Haversine formula.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Sample points along the route geometry every `intervalKm` kilometers.
 * Returns 3–5 sample points (capped at 5).
 */
export function samplePointsAlongRoute(
  geometry: RouteGeometry,
  intervalKm: number = 30,
): { lat: number; lng: number }[] {
  const coords = geometry.geometry.coordinates; // [lng, lat] pairs (GeoJSON)
  if (coords.length === 0) return [];

  const points: { lat: number; lng: number }[] = [];

  // Always include the first point
  points.push({ lat: coords[0][1], lng: coords[0][0] });

  let accumulated = 0;

  for (let i = 1; i < coords.length; i++) {
    const segDist = haversineKm(
      coords[i - 1][1],
      coords[i - 1][0],
      coords[i][1],
      coords[i][0],
    );
    accumulated += segDist;

    if (accumulated >= intervalKm) {
      points.push({ lat: coords[i][1], lng: coords[i][0] });
      accumulated = 0;
    }
  }

  // Always include the last point if it wasn't just added
  const lastCoord = coords[coords.length - 1];
  const lastPoint = points[points.length - 1];
  if (lastPoint.lat !== lastCoord[1] || lastPoint.lng !== lastCoord[0]) {
    points.push({ lat: lastCoord[1], lng: lastCoord[0] });
  }

  // Ensure 3–5 points
  if (points.length > 5) {
    // Evenly sample 5 from the collected points
    const step = (points.length - 1) / 4;
    const sampled: { lat: number; lng: number }[] = [];
    for (let i = 0; i < 5; i++) {
      sampled.push(points[Math.round(i * step)]);
    }
    return sampled;
  }

  // If fewer than 3, interpolate midpoints to reach at least 3
  while (points.length < 3 && coords.length >= 2) {
    const mid = Math.floor(coords.length / 2);
    const midPoint = { lat: coords[mid][1], lng: coords[mid][0] };
    // Insert in the middle
    points.splice(1, 0, midPoint);
  }

  return points.slice(0, 5);
}

/**
 * Fetch POIs near a single point using Google Places Nearby Search.
 * Returns top 5 sorted by (rating * user_ratings_total) descending.
 */
export async function fetchPOIsNearPoint(
  lat: number,
  lng: number,
): Promise<DiscoveredPOI[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set');
  }

  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}` +
    `&radius=5000` +
    `&type=tourist_attraction|cafe|restaurant|natural_feature` +
    `&language=vi` +
    `&key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    const results: any[] = data.results ?? [];

    const pois: DiscoveredPOI[] = results.map((place) => ({
      name: place.name ?? '',
      lat: place.geometry?.location?.lat ?? 0,
      lng: place.geometry?.location?.lng ?? 0,
      type: place.types?.[0] ?? 'point_of_interest',
      description: place.vicinity ?? '',
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      placeId: place.place_id ?? '',
      sources: ['google_places'],
    }));

    // Sort by rating * user_ratings_total descending
    pois.sort((a, b) => {
      const scoreA = (a.rating ?? 0) * (a.userRatingsTotal ?? 0);
      const scoreB = (b.rating ?? 0) * (b.userRatingsTotal ?? 0);
      return scoreB - scoreA;
    });

    return pois.slice(0, 5);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Normalize a string for fuzzy comparison: lowercase, strip diacritics, collapse whitespace.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two POI names are a close match.
 * Uses substring containment after normalization.
 */
function namesCloselyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Simple Jaccard-like word overlap: match if >= 60% words overlap
  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 && intersection / union >= 0.6;
}

/**
 * Discover POIs along a route corridor, merging Google Places results with LLM-extracted POIs.
 * Returns top 10 POIs sorted by relevance score.
 */
export async function fetchPOIsAlongRoute(
  geometry: RouteGeometry,
  llmPOIs: ExtractedPOI[],
): Promise<DiscoveredPOI[]> {
  const samplePoints = samplePointsAlongRoute(geometry);

  // Fetch POIs near each sample point in parallel
  const poiArrays = await Promise.all(
    samplePoints.map((pt) => fetchPOIsNearPoint(pt.lat, pt.lng)),
  );

  // Flatten and deduplicate by placeId
  const seen = new Map<string, DiscoveredPOI>();
  for (const pois of poiArrays) {
    for (const poi of pois) {
      if (!seen.has(poi.placeId)) {
        seen.set(poi.placeId, poi);
      }
    }
  }

  let allPOIs = Array.from(seen.values());

  // Merge with LLM-extracted POIs
  const matchedLLMIndices = new Set<number>();

  for (const poi of allPOIs) {
    const llmIndex = llmPOIs.findIndex(
      (lp, idx) => !matchedLLMIndices.has(idx) && namesCloselyMatch(poi.name, lp.name),
    );
    if (llmIndex !== -1) {
      matchedLLMIndices.add(llmIndex);
      const llmPOI = llmPOIs[llmIndex];
      // Keep Google coordinates but use LLM description
      poi.description = llmPOI.description;
      if (!poi.sources.includes('llm')) {
        poi.sources.push('llm');
      }
    }
  }

  // Add unmatched LLM POIs as DiscoveredPOIs
  for (let i = 0; i < llmPOIs.length; i++) {
    if (!matchedLLMIndices.has(i)) {
      const lp = llmPOIs[i];
      allPOIs.push({
        name: lp.name,
        lat: lp.lat,
        lng: lp.lng,
        type: lp.type,
        description: lp.description,
        placeId: `llm-${normalize(lp.name).replace(/\s+/g, '-')}`,
        sources: [...lp.sources, 'llm'],
      });
    }
  }

  // Sort by relevance score:
  // Google POIs scored by rating * userRatingsTotal
  // LLM-only POIs get a baseline score of 0 but rank below rated Google POIs
  // Merged POIs (both sources) get a boost
  allPOIs.sort((a, b) => {
    const scoreA = relevanceScore(a);
    const scoreB = relevanceScore(b);
    return scoreB - scoreA;
  });

  return allPOIs.slice(0, 10);
}

function relevanceScore(poi: DiscoveredPOI): number {
  const googleScore = (poi.rating ?? 0) * (poi.userRatingsTotal ?? 0);
  const mergeBoost = poi.sources.length > 1 ? 1.5 : 1;
  // LLM-only POIs with no rating get a small baseline
  const baseline = poi.sources.includes('google_places') ? 0 : 1;
  return (googleScore + baseline) * mergeBoost;
}

import { randomUUID } from 'crypto';
import { gatherSources } from '../sources/gather';
import { extractRouteData } from '../llm/extract';
import { geocodeAllWaypoints, geocodeWaypoint } from '../geo/geocode';
import { fetchAllRouteGeometries, fetchBaselineRoute } from '../geo/route';
import { fetchPOIsAlongRoute } from '../geo/pois';
import { synthesizeVibes } from '../llm/synthesize';
import type { SourceQuery } from '../sources/types';
import type { ExtractionResult } from '../llm/types';
import type { GeocodedWaypoint } from '../geo/geocode';
import type { RouteGeometry } from '../geo/route';
import type { DiscoveredPOI } from '../geo/pois';
import type { RouteForSynthesis, VibeSummary } from '../llm/synthesize';
import type {
  GenerateRequest,
  GenerateResponse,
  ProcessedRoute,
  StageResult,
} from './types';
import { DETOUR_CAPS, DEFAULT_CHILL_LEVEL } from './types';

export type OnStageCallback = (stage: StageResult) => void;

async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  stages: StageResult[],
  onStage?: OnStageCallback,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const stage: StageResult = {
      name,
      status: 'success',
      elapsedMs: Date.now() - start,
    };
    stages.push(stage);
    onStage?.(stage);
    return result;
  } catch (error) {
    const stage: StageResult = {
      name,
      status: 'failed',
      elapsedMs: Date.now() - start,
      detail: error instanceof Error ? error.message : String(error),
    };
    stages.push(stage);
    onStage?.(stage);
    throw error;
  }
}

/**
 * Haversine distance in km between two lat/lng points.
 */
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

export async function generateRoutes(
  req: GenerateRequest,
  onStage?: OnStageCallback,
): Promise<GenerateResponse> {
  const pipelineStart = Date.now();
  const stages: StageResult[] = [];
  const tripId = randomUUID();

  const query: SourceQuery = {
    origin: req.origin,
    destination: req.destination,
    originVi: req.originVi || req.origin,
    destinationVi: req.destinationVi || req.destination,
  };

  // Stage 1: Multi-source gathering (parallel)
  const gatherResult = await timed('gather', () => gatherSources(query), stages, onStage);

  if (gatherResult.totalItems < 3) {
    stages[stages.length - 1].status = 'partial';
    stages[stages.length - 1].detail = `Only ${gatherResult.totalItems} items found`;
  }

  const sourcesUsed = gatherResult.sources
    .filter((s) => s.items.length > 0)
    .map((s) => s.source);

  // Stage 2: LLM extraction (pass origin/destination for focused prompting)
  const extraction: ExtractionResult = await timed(
    'extract',
    () => extractRouteData(gatherResult.sources, req.origin, req.destination),
    stages,
    onStage,
  );

  // Stage 3: Geocode waypoints (parallel, chunked)
  // First, geocode the actual origin and destination separately
  const allWaypoints = extraction.routes.flatMap((r) => r.waypoints);
  const uniqueWaypoints = deduplicateByName(allWaypoints);

  const [geocoded, originWp, destWp] = await timed(
    'geocode',
    async () => {
      const [waypointResults, originResult, destResult] = await Promise.all([
        geocodeAllWaypoints(uniqueWaypoints),
        geocodeWaypoint(req.origin).catch(() => null),
        geocodeWaypoint(req.destination).catch(() => null),
      ]);
      return [waypointResults, originResult, destResult] as const;
    },
    stages,
    onStage,
  );

  // Fallback: use first/last geocoded waypoints if dedicated geocoding failed
  const resolvedOrigin: GeocodedWaypoint = originWp ?? geocoded[0];
  const resolvedDest: GeocodedWaypoint = destWp ?? geocoded[geocoded.length - 1];

  // Stage 4: Route geometry (parallel per route) + baseline
  // Pass origin/destination so they're always injected as endpoints
  const geometries: RouteGeometry[] = await timed('route', async () => {
    const routeGeometries = await fetchAllRouteGeometries(
      extraction.routes,
      geocoded,
      resolvedOrigin,
      resolvedDest,
    );

    // Also fetch baseline (direct A to B)
    const baseline = await fetchBaselineRoute(resolvedOrigin, resolvedDest);
    if (baseline) {
      routeGeometries.push(baseline);
    }

    return routeGeometries;
  }, stages, onStage);

  // Validate routes: discard any whose endpoint is too far from destination
  const ENDPOINT_THRESHOLD_KM = 20;
  const validGeometries = geometries.filter((geo) => {
    if (geo.routeId === 'baseline') return true;
    const coords = geo.geometry.coordinates;
    if (coords.length === 0) return false;
    const lastCoord = coords[coords.length - 1];
    const distToDestKm = haversineKm(
      lastCoord[1], lastCoord[0],
      resolvedDest.lat, resolvedDest.lng,
    );
    return distToDestKm <= ENDPOINT_THRESHOLD_KM;
  });

  // Stage 5: POI discovery (parallel per route)
  const poisPerRoute: DiscoveredPOI[][] = await timed('pois', async () => {
    const results = await Promise.allSettled(
      validGeometries.map((g) =>
        fetchPOIsAlongRoute(g, extraction.pois || []),
      ),
    );
    return results.map((r) => (r.status === 'fulfilled' ? r.value : []));
  }, stages, onStage);

  // Stage 6: Assemble routes and synthesize vibes
  const assembledRoutes = assembleRoutes(
    extraction,
    validGeometries,
    geocoded,
    poisPerRoute,
  );

  // Compute detour ratios against baseline
  const baselineRoute = assembledRoutes.find((r) => r.isBaseline);
  const baselineDuration = baselineRoute?.durationMinutes ?? 0;

  const routesWithDetour: ProcessedRoute[] = assembledRoutes.map((route) => {
    const detourRatio =
      route.isBaseline || baselineDuration === 0
        ? 1
        : route.durationMinutes / baselineDuration;
    return {
      ...route,
      baselineDurationMinutes: baselineDuration,
      detourRatio: Math.round(detourRatio * 100) / 100,
    };
  });

  // Apply detour cap filtering (only when chillLevel is explicitly set)
  const chillLevel = req.preferences?.chillLevel ?? DEFAULT_CHILL_LEVEL;
  const maxRatio = DETOUR_CAPS[chillLevel] ?? Infinity;
  const beforeFilterCount = routesWithDetour.filter((r) => !r.isBaseline).length;

  const cappedRoutes = routesWithDetour.filter(
    (route) => route.isBaseline || route.detourRatio <= maxRatio,
  );
  const routesFiltered = beforeFilterCount - cappedRoutes.filter((r) => !r.isBaseline).length;

  const vibes: VibeSummary[] = await timed(
    'synthesize',
    () => synthesizeVibes(cappedRoutes.map(routeToSynthesisInput)),
    stages,
    onStage,
  );

  // Merge vibe summaries into routes
  const vibeMap = new Map(vibes.map((v) => [v.routeId, v.vibeSummary]));
  const finalRoutes: ProcessedRoute[] = cappedRoutes.map((route) => ({
    ...route,
    vibeSummary: vibeMap.get(route.id) || route.description,
  }));

  return {
    tripId,
    origin: req.origin,
    destination: req.destination,
    routes: finalRoutes,
    generationMeta: {
      totalElapsedMs: Date.now() - pipelineStart,
      stages,
      sourcesUsed,
      llmModel: process.env.LLM_MODEL || 'qwen/qwen3-next-80b-a3b-instruct:free',
      detourCap: {
        chillLevel,
        maxDurationRatio: maxRatio,
        routesFiltered,
      },
    },
  };
}

function deduplicateByName<T extends { name: string }>(
  waypoints: T[],
): T[] {
  const seen = new Set<string>();
  return waypoints.filter((wp) => {
    const key = wp.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assembleRoutes(
  extraction: ExtractionResult,
  geometries: RouteGeometry[],
  geocoded: GeocodedWaypoint[],
  poisPerRoute: DiscoveredPOI[][],
): ProcessedRoute[] {
  const routes: ProcessedRoute[] = [];

  for (let i = 0; i < geometries.length; i++) {
    const geo = geometries[i];
    const isBaseline = geo.routeId === 'baseline';

    // Find matching extracted route
    const extractedRoute = extraction.routes.find(
      (r) => r.id === geo.routeId,
    );

    // Match geocoded waypoints for this route
    const routeWaypoints = isBaseline
      ? [geocoded[0], geocoded[geocoded.length - 1]]
      : geo.waypoints
          .map((wp) =>
            geocoded.find(
              (g) =>
                g.name.toLowerCase().includes(wp.name.toLowerCase()) ||
                wp.name.toLowerCase().includes(g.name.toLowerCase()),
            ),
          )
          .filter((wp): wp is GeocodedWaypoint => wp != null);

    routes.push({
      id: geo.routeId,
      name: extractedRoute?.name || (isBaseline ? 'Fastest Route (Baseline)' : `Route ${i + 1}`),
      description: extractedRoute?.description || (isBaseline ? 'Direct fastest route' : ''),
      vibeSummary: '', // filled in later
      primaryRoad: extractedRoute?.primary_road || '',
      distanceKm: geo.distanceKm,
      durationMinutes: geo.durationMinutes,
      baselineDurationMinutes: 0, // computed after assembly
      detourRatio: 1, // computed after assembly
      geometry: geo.geometry,
      waypoints: routeWaypoints.map((wp) => ({
        name: wp.name,
        lat: wp.lat,
        lng: wp.lng,
        source: wp.source,
        confidence: wp.confidence,
      })),
      scenicSegments: extractedRoute?.scenic_segments || [],
      pois: poisPerRoute[i] || [],
      isBaseline,
    });
  }

  return routes;
}

function routeToSynthesisInput(route: ProcessedRoute): RouteForSynthesis {
  return {
    id: route.id,
    name: route.name,
    description: route.description,
    primaryRoad: route.primaryRoad,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    scenicSegments: route.scenicSegments.map((s) => ({
      name: s.name,
      description: s.description,
    })),
    pois: route.pois.map((p) => ({
      name: p.name,
      type: p.type,
      description: p.description,
    })),
  };
}

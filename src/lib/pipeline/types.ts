import type { ScenicSegment } from '../llm/types';
import type { DiscoveredPOI } from '../geo/pois';

export interface GenerateRequest {
  origin: string;
  destination: string;
  originVi?: string;
  destinationVi?: string;
  preferences?: {
    chillLevel?: 'low' | 'medium' | 'high';
    maxStops?: number;
    vibes?: ('nature' | 'cafes' | 'viewpoints')[];
  };
}

export interface GenerateResponse {
  tripId: string;
  origin: string;
  destination: string;
  routes: ProcessedRoute[];
  generationMeta: {
    totalElapsedMs: number;
    stages: StageResult[];
    sourcesUsed: string[];
    llmModel: string;
    detourCap: {
      chillLevel: string;
      maxDurationRatio: number;
      routesFiltered: number;
    };
  };
}

export interface ProcessedRoute {
  id: string;
  name: string;
  description: string;
  vibeSummary: string;
  primaryRoad: string;
  distanceKm: number;
  durationMinutes: number;
  baselineDurationMinutes: number;
  detourRatio: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  waypoints: ProcessedWaypoint[];
  scenicSegments: ScenicSegment[];
  pois: DiscoveredPOI[];
  isBaseline: boolean;
}

/** Maps chillLevel preference to max allowed duration ratio vs baseline */
export const DETOUR_CAPS: Record<string, number> = {
  low: 1.5,
  medium: 2.0,
  high: 3.0,
};

/** When no chillLevel is set, no filtering is applied */
export const DEFAULT_CHILL_LEVEL = 'none';

export interface ProcessedWaypoint {
  name: string;
  lat: number;
  lng: number;
  source: 'google' | 'mapbox' | 'llm_estimate';
  confidence: 'high' | 'medium' | 'low';
}

export interface StageResult {
  name: string;
  status: 'success' | 'partial' | 'failed';
  elapsedMs: number;
  detail?: string;
}

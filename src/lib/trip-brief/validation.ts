import type { GenerateResponse, ProcessedRoute } from '@/lib/pipeline/types';

function isLineStringCoordinates(value: unknown): value is [number, number][] {
  if (!Array.isArray(value)) return false;
  return value.every((point) =>
    Array.isArray(point) &&
    point.length === 2 &&
    typeof point[0] === 'number' &&
    Number.isFinite(point[0]) &&
    typeof point[1] === 'number' &&
    Number.isFinite(point[1]),
  );
}

function isProcessedRoute(value: unknown): value is ProcessedRoute {
  if (!value || typeof value !== 'object') return false;
  const route = value as Record<string, unknown>;

  return (
    typeof route.id === 'string' &&
    typeof route.name === 'string' &&
    typeof route.description === 'string' &&
    typeof route.vibeSummary === 'string' &&
    typeof route.primaryRoad === 'string' &&
    typeof route.distanceKm === 'number' &&
    typeof route.durationMinutes === 'number' &&
    typeof route.baselineDurationMinutes === 'number' &&
    typeof route.detourRatio === 'number' &&
    !!route.geometry &&
    typeof route.geometry === 'object' &&
    (route.geometry as Record<string, unknown>).type === 'LineString' &&
    isLineStringCoordinates((route.geometry as Record<string, unknown>).coordinates) &&
    Array.isArray(route.waypoints) &&
    Array.isArray(route.scenicSegments) &&
    Array.isArray(route.pois) &&
    typeof route.isBaseline === 'boolean'
  );
}

function isGenerateResponse(value: unknown): value is GenerateResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.tripId === 'string' &&
    typeof response.origin === 'string' &&
    typeof response.destination === 'string' &&
    Array.isArray(response.routes) &&
    response.routes.every(isProcessedRoute)
  );
}

export type CreateTripBriefValidation =
  | { ok: true; value: GenerateResponse }
  | { ok: false; error: string };

export function validateCreateTripBriefRequest(input: unknown): CreateTripBriefValidation {
  if (!isGenerateResponse(input)) {
    return {
      ok: false,
      error: 'invalid trip brief payload',
    };
  }

  if (input.routes.length === 0) {
    return {
      ok: false,
      error: 'at least one route is required',
    };
  }

  return {
    ok: true,
    value: input,
  };
}

export type VoteValidation =
  | { ok: true; value: { routeId: string; idempotencyKey: string | null } }
  | { ok: false; error: string };

export function validateVoteRequest(input: unknown): VoteValidation {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      error: 'invalid vote payload',
    };
  }

  const body = input as Record<string, unknown>;
  const routeId = typeof body.routeId === 'string' ? body.routeId.trim() : '';
  if (!routeId) {
    return {
      ok: false,
      error: 'routeId is required',
    };
  }

  const idempotencyKey =
    typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : null;

  return {
    ok: true,
    value: {
      routeId,
      idempotencyKey,
    },
  };
}

import type { GenerateRequest } from '@/lib/pipeline/types';

const LOCATION_MAX_LENGTH = 200;
const LOCATION_PATTERN = /^[\p{L}\p{M}\p{N}\s.,'’\-()&/]+$/u;
const CHILL_LEVELS = new Set(['low', 'medium', 'high']);

function normalizeLocation(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function validateLocation(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeLocation(value);
  if (normalized.length < 2 || normalized.length > LOCATION_MAX_LENGTH) {
    return null;
  }

  if (!LOCATION_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractChillLevel(value: unknown): 'low' | 'medium' | 'high' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (!CHILL_LEVELS.has(value)) {
    return undefined;
  }

  return value as 'low' | 'medium' | 'high';
}

export type ValidationResult =
  | { ok: true; value: GenerateRequest }
  | { ok: false; error: string };

export function validateGenerateRequest(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      error: 'invalid request body',
    };
  }

  const body = input as Record<string, unknown>;

  const origin = validateLocation(body.origin);
  const destination = validateLocation(body.destination);

  if (!origin || !destination) {
    return {
      ok: false,
      error: 'origin and destination are required and must be valid place names',
    };
  }

  const originVi = validateLocation(body.originVi) ?? origin;
  const destinationVi = validateLocation(body.destinationVi) ?? destination;

  const preferences =
    body.preferences && typeof body.preferences === 'object'
      ? (body.preferences as Record<string, unknown>)
      : undefined;

  const chillLevel = extractChillLevel(preferences?.chillLevel);

  return {
    ok: true,
    value: {
      origin,
      destination,
      originVi,
      destinationVi,
      preferences: chillLevel ? { chillLevel } : undefined,
    },
  };
}

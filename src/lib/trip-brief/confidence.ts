import type { ProcessedRoute } from '@/lib/pipeline/types';
import type { RouteConfidence } from './types';

interface BadgeMeta {
  label: string;
  className: string;
}

const BADGE_META: Record<RouteConfidence, BadgeMeta> = {
  high: {
    label: 'High confidence',
    className: 'bg-emerald-50 text-emerald-700',
  },
  medium: {
    label: 'Medium confidence',
    className: 'bg-amber-50 text-amber-700',
  },
  low: {
    label: 'Low confidence',
    className: 'bg-rose-50 text-rose-700',
  },
};

export function evaluateRouteConfidence(route: ProcessedRoute): RouteConfidence {
  const hasGeometry = route.geometry.coordinates.length >= 2;
  const highWaypointCount = route.waypoints.filter((wp) => wp.confidence === 'high').length;
  const lowWaypointCount = route.waypoints.filter((wp) => wp.confidence === 'low').length;
  const hasEvidence = route.scenicSegments.length + route.pois.length >= 2;

  if (hasGeometry && lowWaypointCount === 0 && highWaypointCount >= 2 && hasEvidence) {
    return 'high';
  }

  if (hasGeometry && highWaypointCount >= 1) {
    return 'medium';
  }

  return 'low';
}

export function getRouteConfidence(route: ProcessedRoute & { confidence?: RouteConfidence }): RouteConfidence {
  if (route.confidence) return route.confidence;
  return evaluateRouteConfidence(route);
}

export function getConfidenceBadgeMeta(confidence: RouteConfidence): BadgeMeta {
  return BADGE_META[confidence];
}

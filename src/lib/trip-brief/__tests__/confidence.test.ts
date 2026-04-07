import { evaluateRouteConfidence, getConfidenceBadgeMeta } from '../confidence';

describe('trip brief confidence', () => {
  test('returns high confidence for strong evidence route', () => {
    const confidence = evaluateRouteConfidence({
      id: 'route_a',
      name: 'Route A',
      description: 'desc',
      vibeSummary: 'vibe',
      primaryRoad: 'QL1A',
      distanceKm: 100,
      durationMinutes: 120,
      baselineDurationMinutes: 100,
      detourRatio: 1.2,
      geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3], [107.2, 10.2]] },
      waypoints: [
        { name: 'A', lat: 10.8, lng: 106.7, source: 'google', confidence: 'high' },
        { name: 'B', lat: 10.3, lng: 107.1, source: 'google', confidence: 'high' },
      ],
      scenicSegments: [{ name: 'Coast', description: 'views' }],
      pois: [{ name: 'Cafe', type: 'cafe', lat: 10.5, lng: 107, description: 'stop' }],
      isBaseline: false,
    });

    expect(confidence).toBe('high');
    expect(getConfidenceBadgeMeta(confidence).label).toBe('High confidence');
  });

  test('returns low confidence for weak geometry/evidence', () => {
    const confidence = evaluateRouteConfidence({
      id: 'route_b',
      name: 'Route B',
      description: 'desc',
      vibeSummary: 'vibe',
      primaryRoad: 'QL1A',
      distanceKm: 100,
      durationMinutes: 120,
      baselineDurationMinutes: 100,
      detourRatio: 1.2,
      geometry: { type: 'LineString', coordinates: [[106.7, 10.8]] },
      waypoints: [{ name: 'A', lat: 10.8, lng: 106.7, source: 'llm_estimate', confidence: 'low' }],
      scenicSegments: [],
      pois: [],
      isBaseline: false,
    });

    expect(confidence).toBe('low');
  });
});

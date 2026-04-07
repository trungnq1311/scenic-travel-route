import { validateCreateTripBriefRequest, validateVoteRequest } from '../validation';

describe('trip brief validation', () => {
  test('validates create payload shape', () => {
    const result = validateCreateTripBriefRequest({
      tripId: 'trip-1',
      origin: 'HCM',
      destination: 'VT',
      routes: [
        {
          id: 'route_a',
          name: 'Route A',
          description: 'desc',
          vibeSummary: 'vibe',
          primaryRoad: 'QL1A',
          distanceKm: 100,
          durationMinutes: 120,
          baselineDurationMinutes: 100,
          detourRatio: 1.2,
          geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3]] },
          waypoints: [],
          scenicSegments: [],
          pois: [],
          isBaseline: false,
        },
      ],
    });

    expect(result.ok).toBe(true);
  });

  test('rejects invalid vote payload', () => {
    const invalid = validateVoteRequest({ routeId: '' });
    expect(invalid.ok).toBe(false);

    const valid = validateVoteRequest({ routeId: 'route_a', idempotencyKey: 'abc' });
    expect(valid.ok).toBe(true);
  });
});

import { samplePointsAlongRoute } from '../pois';
import type { RouteGeometry } from '../route';

describe('samplePointsAlongRoute', () => {
  test('returns 3-5 points including endpoints', () => {
    const route: RouteGeometry = {
      routeId: 'r1',
      geometry: {
        type: 'LineString',
        coordinates: [
          [106.7, 10.8],
          [106.8, 10.75],
          [106.9, 10.7],
          [107.0, 10.6],
          [107.1, 10.3],
        ],
      },
      distanceKm: 100,
      durationMinutes: 120,
      waypoints: [],
    };

    const points = samplePointsAlongRoute(route, 10);

    expect(points.length).toBeGreaterThanOrEqual(3);
    expect(points.length).toBeLessThanOrEqual(5);
    expect(points[0]).toEqual({ lat: 10.8, lng: 106.7 });
    expect(points[points.length - 1]).toEqual({ lat: 10.3, lng: 107.1 });
  });
});

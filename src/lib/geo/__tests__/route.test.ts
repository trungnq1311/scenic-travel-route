import { fetchAllRouteGeometries } from '../route';
import type { ExtractedRoute } from '../../llm/types';
import type { GeocodedWaypoint } from '../geocode';

describe('fetchAllRouteGeometries', () => {
  const originalFetch = global.fetch;
  const originalMapbox = process.env.MAPBOX_API_KEY;

  beforeEach(() => {
    process.env.MAPBOX_API_KEY = 'mapbox';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.MAPBOX_API_KEY = originalMapbox;
    jest.restoreAllMocks();
  });

  test('injects origin and destination endpoints into route request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [[106.7, 10.8], [107.1, 10.3]],
            },
            distance: 100000,
            duration: 7200,
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const routes: ExtractedRoute[] = [
      {
        id: 'route_1',
        name: 'Scenic',
        description: 'desc',
        primary_road: 'QL51',
        estimated_distance_km: 100,
        waypoints: [{ name: 'Midpoint', lat: 10.6, lng: 106.9, type: 'town', description: '', sources: [] }],
        scenic_segments: [],
      },
    ];

    const geocodedWaypoints: GeocodedWaypoint[] = [
      { name: 'Midpoint', lat: 10.6, lng: 106.9, source: 'google', confidence: 'high' },
    ];

    const origin: GeocodedWaypoint = {
      name: 'Origin',
      lat: 10.8,
      lng: 106.7,
      source: 'google',
      confidence: 'high',
    };

    const destination: GeocodedWaypoint = {
      name: 'Destination',
      lat: 10.3,
      lng: 107.1,
      source: 'google',
      confidence: 'high',
    };

    const result = await fetchAllRouteGeometries(
      routes,
      geocodedWaypoints,
      origin,
      destination,
    );

    expect(result).toHaveLength(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('106.7,10.8');
    expect(calledUrl).toContain('107.1,10.3');
  });
});

import { generateRoutes } from '../generate';

jest.mock('../../sources/gather', () => ({
  gatherSources: jest.fn(async () => ({
    sources: [
      { source: 'web_search', items: [{ title: 'a', content: 'b' }], queryCount: 1, elapsedMs: 1 },
    ],
    totalItems: 1,
    elapsedMs: 1,
  })),
}));

jest.mock('../../llm/extract', () => ({
  extractRouteData: jest.fn(async () => ({
    corridor: 'HCM to VT',
    routes: [
      {
        id: 'route_1',
        name: 'Route 1',
        description: 'desc',
        primary_road: 'QL51',
        estimated_distance_km: 100,
        waypoints: [
          { name: 'HCM', lat: 10.8, lng: 106.7, type: 'city', description: '', sources: ['web_search'] },
          { name: 'VT', lat: 10.3, lng: 107.1, type: 'city', description: '', sources: ['web_search'] },
        ],
        scenic_segments: [],
      },
    ],
    roads_mentioned: [],
    pois: [],
    source_summary: {
      web_search_findings: 1,
      tiktok_findings: 0,
      google_reviews_findings: 0,
      cross_source_corroborations: 0,
    },
  })),
}));

jest.mock('../../geo/geocode', () => ({
  geocodeAllWaypoints: jest.fn(async () => [
    { name: 'HCM', lat: 10.8, lng: 106.7, source: 'google', confidence: 'high' },
    { name: 'VT', lat: 10.3, lng: 107.1, source: 'google', confidence: 'high' },
  ]),
  geocodeWaypoint: jest.fn(async (name: string) =>
    name.toLowerCase().includes('ho')
      ? { name, lat: 10.8, lng: 106.7, source: 'google', confidence: 'high' }
      : { name, lat: 10.3, lng: 107.1, source: 'google', confidence: 'high' },
  ),
}));

jest.mock('../../geo/route', () => ({
  fetchAllRouteGeometries: jest.fn(async () => [
    {
      routeId: 'route_1',
      geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3]] },
      distanceKm: 100,
      durationMinutes: 120,
      waypoints: [
        { name: 'HCM', lat: 10.8, lng: 106.7 },
        { name: 'VT', lat: 10.3, lng: 107.1 },
      ],
    },
  ]),
  fetchBaselineRoute: jest.fn(async () => ({
    routeId: 'baseline',
    geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3]] },
    distanceKm: 90,
    durationMinutes: 90,
    waypoints: [
      { name: 'HCM', lat: 10.8, lng: 106.7 },
      { name: 'VT', lat: 10.3, lng: 107.1 },
    ],
  })),
}));

jest.mock('../../geo/pois', () => ({
  fetchPOIsAlongRoute: jest.fn(async () => []),
}));

jest.mock('../../llm/synthesize', () => ({
  synthesizeVibes: jest.fn(async (routes: Array<{ id: string; description: string }>) =>
    routes.map((r) => ({ routeId: r.id, vibeSummary: `${r.description} vibe` })),
  ),
}));

describe('generateRoutes', () => {
  test('returns route results with detour metadata', async () => {
    const result = await generateRoutes({
      origin: 'Ho Chi Minh City',
      destination: 'Vung Tau',
    });

    expect(result.tripId).toBeTruthy();
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.generationMeta.stages.length).toBeGreaterThan(0);

    const baseline = result.routes.find((r) => r.isBaseline);
    expect(baseline).toBeTruthy();
  });
});

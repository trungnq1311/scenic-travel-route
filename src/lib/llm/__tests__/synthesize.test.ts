import { synthesizeVibes } from '../synthesize';

describe('synthesizeVibes', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENROUTER_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  test('falls back to route description when key missing', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const result = await synthesizeVibes([
      {
        id: 'r1',
        name: 'Route 1',
        description: 'Fallback description',
        primaryRoad: 'QL51',
        distanceKm: 100,
        durationMinutes: 120,
        scenicSegments: [],
        pois: [],
      },
    ]);

    expect(result).toEqual([
      { routeId: 'r1', vibeSummary: 'Fallback description' },
    ]);
  });
});

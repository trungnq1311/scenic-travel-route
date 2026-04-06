import { geocodeWaypoint } from '../geocode';

describe('geocodeWaypoint', () => {
  const originalFetch = global.fetch;
  const originalGoogleKey = process.env.GOOGLE_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'google-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GOOGLE_API_KEY = originalGoogleKey;
    jest.restoreAllMocks();
  });

  test('uses google geocoding result when available', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            geometry: {
              location: { lat: 10.8, lng: 106.7 },
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const result = await geocodeWaypoint('Ho Chi Minh City');

    expect(result.source).toBe('google');
    expect(result.lat).toBeCloseTo(10.8);
    expect(result.lng).toBeCloseTo(106.7);
  });
});

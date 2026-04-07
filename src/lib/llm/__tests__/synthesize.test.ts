import { synthesizeVibes } from '../synthesize';

describe('synthesizeVibes', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalMaxRetries = process.env.OPENROUTER_MAX_RETRIES;
  const originalRetryBaseMs = process.env.OPENROUTER_RETRY_BASE_MS;
  const originalFallbackModels = process.env.LLM_FALLBACK_MODELS;
  const originalModel = process.env.LLM_MODEL;

  beforeEach(() => {
    process.env.OPENROUTER_MAX_RETRIES = '0';
    process.env.OPENROUTER_RETRY_BASE_MS = '1';
    delete process.env.LLM_FALLBACK_MODELS;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENROUTER_API_KEY = originalKey;
    process.env.OPENROUTER_MAX_RETRIES = originalMaxRetries;
    process.env.OPENROUTER_RETRY_BASE_MS = originalRetryBaseMs;
    process.env.LLM_FALLBACK_MODELS = originalFallbackModels;
    process.env.LLM_MODEL = originalModel;
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

  test('retries 429 with fallback model and returns synthesized summary', async () => {
    process.env.OPENROUTER_API_KEY = 'or-key';
    process.env.LLM_MODEL = 'primary/model';
    process.env.LLM_FALLBACK_MODELS = 'fallback/model';

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { routeId: 'r1', vibeSummary: 'Fresh ocean-breeze drive' },
                ]),
              },
            },
          ],
        }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

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

    const firstCallBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(firstCallBody.model).toBe('primary/model');
    expect(secondCallBody.model).toBe('fallback/model');
    expect(result).toEqual([{ routeId: 'r1', vibeSummary: 'Fresh ocean-breeze drive' }]);
  });
});

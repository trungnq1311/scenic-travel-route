import { extractRouteData } from '../extract';
import type { SourceResult } from '../../sources/types';

describe('extractRouteData', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalMaxRetries = process.env.OPENROUTER_MAX_RETRIES;
  const originalRetryBaseMs = process.env.OPENROUTER_RETRY_BASE_MS;
  const originalFallbackModels = process.env.LLM_FALLBACK_MODELS;
  const originalModel = process.env.LLM_MODEL;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'or-key';
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

  test('parses valid OpenRouter JSON response', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              corridor: 'HCM to Vung Tau',
              routes: [],
              roads_mentioned: [],
              pois: [],
              source_summary: {
                web_search_findings: 0,
                tiktok_findings: 0,
                google_reviews_findings: 0,
                cross_source_corroborations: 0,
              },
            }),
          },
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const sources: SourceResult[] = [];
    const result = await extractRouteData(sources, 'HCM', 'Vung Tau');

    expect(result.corridor).toBe('HCM to Vung Tau');
    expect(Array.isArray(result.routes)).toBe(true);
  });

  test('retries 429 with fallback model and succeeds', async () => {
    process.env.LLM_MODEL = 'primary/model';
    process.env.LLM_FALLBACK_MODELS = 'fallback/model';

    const successResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              corridor: 'fallback corridor',
              routes: [],
            }),
          },
        },
      ],
    };

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
        text: async () => 'rate limit',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await extractRouteData([], 'HCM', 'Vung Tau');

    const firstCallBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(firstCallBody.model).toBe('primary/model');
    expect(secondCallBody.model).toBe('fallback/model');
    expect(result.corridor).toBe('fallback corridor');
  });

  test('uses built-in fallback models when LLM_FALLBACK_MODELS is unset', async () => {
    process.env.LLM_MODEL = 'primary/model';
    delete process.env.LLM_FALLBACK_MODELS;

    const successResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              corridor: 'default fallback corridor',
              routes: [],
            }),
          },
        },
      ],
    };

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
        text: async () => 'rate limit',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await extractRouteData([], 'HCM', 'Vung Tau');

    const firstCallBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(firstCallBody.model).toBe('primary/model');
    expect(secondCallBody.model).toBe('stepfun/step-3.5-flash:free');
    expect(result.corridor).toBe('default fallback corridor');
  });
});

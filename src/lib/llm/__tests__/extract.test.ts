import { extractRouteData } from '../extract';
import type { SourceResult } from '../../sources/types';

describe('extractRouteData', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'or-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENROUTER_API_KEY = originalKey;
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
});
